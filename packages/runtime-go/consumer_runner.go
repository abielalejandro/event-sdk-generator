package runtime

import (
	"context"
	"sync"
	"time"
)

// ConsumerRunnerOptions configures background consumption.
type ConsumerRunnerOptions struct {
	Concurrency  int
	IdleDelay    time.Duration
	Unhandled    MessageAction
	HandlerError MessageAction
	OnError      func(error, ReceivedMessage)
}

// ConsumerRunner connects a MessageSource to a generated EventConsumer.
type ConsumerRunner struct {
	source   MessageSource
	consumer EventConsumer
	opts     ConsumerRunnerOptions
}

func NewConsumerRunner(source MessageSource, consumer EventConsumer, opts ConsumerRunnerOptions) *ConsumerRunner {
	if opts.Concurrency <= 0 {
		opts.Concurrency = 1
	}
	if opts.IdleDelay <= 0 {
		opts.IdleDelay = time.Second
	}
	if opts.Unhandled == "" {
		opts.Unhandled = MessageActionAck
	}
	if opts.HandlerError == "" {
		opts.HandlerError = MessageActionRetry
	}
	return &ConsumerRunner{source: source, consumer: consumer, opts: opts}
}

func (r *ConsumerRunner) Start(ctx context.Context) error {
	defer r.source.Close(ctx)
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		messages, err := r.source.Receive(ctx, ReceiveOptions{MaxMessages: r.opts.Concurrency})
		if err != nil {
			r.report(err, nil)
			if waitErr := sleep(ctx, r.opts.IdleDelay); waitErr != nil {
				return waitErr
			}
			continue
		}
		if len(messages) == 0 {
			if waitErr := sleep(ctx, r.opts.IdleDelay); waitErr != nil {
				return waitErr
			}
			continue
		}

		var wg sync.WaitGroup
		for _, message := range messages {
			wg.Add(1)
			go func(message ReceivedMessage) {
				defer wg.Done()
				r.process(ctx, message)
			}(message)
		}
		wg.Wait()
	}
}

func (r *ConsumerRunner) process(ctx context.Context, message ReceivedMessage) {
	handled, err := r.consumer.Handle(ctx, message.Envelope())
	if err != nil {
		r.report(err, message)
		_ = r.applyAction(ctx, r.opts.HandlerError, message, err)
		return
	}
	if handled {
		_ = message.Ack(ctx)
		return
	}
	_ = r.applyAction(ctx, r.opts.Unhandled, message, nil)
}

func (r *ConsumerRunner) applyAction(ctx context.Context, action MessageAction, message ReceivedMessage, err error) error {
	switch action {
	case MessageActionAck:
		return message.Ack(ctx)
	case MessageActionRetry:
		return message.Retry(ctx, err)
	case MessageActionDeadLetter:
		return message.DeadLetter(ctx, err)
	default:
		return nil
	}
}

func (r *ConsumerRunner) report(err error, message ReceivedMessage) {
	if r.opts.OnError != nil {
		r.opts.OnError(err, message)
	}
}

func sleep(ctx context.Context, delay time.Duration) error {
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}
