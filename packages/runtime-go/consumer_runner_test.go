package runtime_test

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	runtime "github.com/eventgen/runtime-go"
	"github.com/eventgen/runtime-go/adapters"
)

type testConsumer struct {
	handled      bool
	err          error
	calls        atomic.Int32
	cancel       context.CancelFunc
	cancelOnCall int32
}

func (c *testConsumer) Handle(_ context.Context, _ runtime.EventEnvelope) (bool, error) {
	calls := c.calls.Add(1)
	shouldCancel := c.cancelOnCall <= 0 && c.err == nil || c.cancelOnCall > 0 && calls >= c.cancelOnCall
	if c.cancel != nil && shouldCancel {
		c.cancel()
	}
	if c.err != nil {
		return false, c.err
	}
	return c.handled, nil
}

func TestConsumerRunnerAcksMessagesHandledByConsumer(t *testing.T) {
	source := adapters.NewInMemoryMessageSource(envelope())
	ctx, cancel := context.WithCancel(context.Background())
	consumer := &testConsumer{handled: true, cancel: cancel}
	runner := runtime.NewConsumerRunner(source, consumer, runtime.ConsumerRunnerOptions{IdleDelay: time.Millisecond})

	err := runner.Start(ctx)
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context cancellation, got %v", err)
	}
	if consumer.calls.Load() != 1 {
		t.Fatalf("expected one handler call, got %d", consumer.calls.Load())
	}
	if !source.Messages[0].Acked {
		t.Fatal("expected message to be acked")
	}
}

func TestConsumerRunnerAppliesUnhandledPolicy(t *testing.T) {
	source := adapters.NewInMemoryMessageSource(envelope())
	ctx, cancel := context.WithCancel(context.Background())
	consumer := &testConsumer{handled: false, cancel: cancel}
	runner := runtime.NewConsumerRunner(source, consumer, runtime.ConsumerRunnerOptions{
		IdleDelay: time.Millisecond,
		Unhandled: runtime.MessageActionAck,
	})

	err := runner.Start(ctx)
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context cancellation, got %v", err)
	}
	if !source.Messages[0].Acked {
		t.Fatal("expected unhandled message to be acked")
	}
}

func TestConsumerRunnerRetriesMessagesWhenHandlerFails(t *testing.T) {
	source := adapters.NewInMemoryMessageSource(envelope())
	ctx, cancel := context.WithCancel(context.Background())
	consumer := &testConsumer{err: errors.New("boom"), cancel: cancel, cancelOnCall: 2}
	runner := runtime.NewConsumerRunner(source, consumer, runtime.ConsumerRunnerOptions{
		IdleDelay:    time.Millisecond,
		HandlerError: runtime.MessageActionRetry,
	})

	err := runner.Start(ctx)
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context cancellation, got %v", err)
	}
	if source.Messages[0].Attempts < 2 {
		t.Fatalf("expected message to be retried, got %d attempts", source.Messages[0].Attempts)
	}
}

func TestConsumerRunnerDeadLettersMessagesWhenHandlerFailsAndPolicyRequiresIt(t *testing.T) {
	source := adapters.NewInMemoryMessageSource(envelope())
	ctx, cancel := context.WithCancel(context.Background())
	consumer := &testConsumer{err: errors.New("boom"), cancel: cancel, cancelOnCall: 1}
	runner := runtime.NewConsumerRunner(source, consumer, runtime.ConsumerRunnerOptions{
		IdleDelay:    time.Millisecond,
		HandlerError: runtime.MessageActionDeadLetter,
	})

	err := runner.Start(ctx)
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context cancellation, got %v", err)
	}
	if !source.Messages[0].DeadLettered {
		t.Fatal("expected failed message to be dead-lettered")
	}
	if len(source.DeadLetters) != 1 {
		t.Fatalf("expected one dead letter, got %d", len(source.DeadLetters))
	}
}

func TestConsumerRunnerProcessesMessagesUpToConfiguredConcurrency(t *testing.T) {
	source := adapters.NewInMemoryMessageSource(envelopeWithTraceID("trace-1"), envelopeWithTraceID("trace-2"))
	ctx, cancel := context.WithCancel(context.Background())
	consumer := &testConsumer{handled: true, cancel: cancel, cancelOnCall: 2}
	runner := runtime.NewConsumerRunner(source, consumer, runtime.ConsumerRunnerOptions{
		Concurrency: 2,
		IdleDelay:   time.Millisecond,
	})

	err := runner.Start(ctx)
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context cancellation, got %v", err)
	}
	if consumer.calls.Load() != 2 {
		t.Fatalf("expected two handler calls, got %d", consumer.calls.Load())
	}
	for index, message := range source.Messages {
		if !message.Acked {
			t.Fatalf("expected message %d to be acked", index)
		}
		if message.Attempts != 1 {
			t.Fatalf("expected message %d to be received once, got %d attempts", index, message.Attempts)
		}
	}
}

func TestConsumerRunnerClosesSourceWhenContextIsCancelled(t *testing.T) {
	source := &closeTrackingSource{}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	consumer := &testConsumer{handled: true}
	runner := runtime.NewConsumerRunner(source, consumer, runtime.ConsumerRunnerOptions{IdleDelay: time.Millisecond})

	err := runner.Start(ctx)
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context cancellation, got %v", err)
	}
	if !source.closed.Load() {
		t.Fatal("expected source to be closed")
	}
}

type closeTrackingSource struct {
	closed atomic.Bool
}

func (s *closeTrackingSource) Receive(context.Context, runtime.ReceiveOptions) ([]runtime.ReceivedMessage, error) {
	return nil, nil
}

func (s *closeTrackingSource) Close(context.Context) error {
	s.closed.Store(true)
	return nil
}

func envelope() runtime.EventEnvelope {
	return envelopeWithTraceID("trace-1")
}

func envelopeWithTraceID(traceID string) runtime.EventEnvelope {
	return runtime.EventEnvelope{
		EventID: "payments.payment_created",
		Version: "1.0.0",
		Payload: map[string]any{},
		Metadata: runtime.EventMetadata{
			CreatedAt: "2026-07-17T00:00:00.000Z",
			TraceID:   traceID,
		},
	}
}
