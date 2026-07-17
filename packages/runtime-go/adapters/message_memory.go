package adapters

import (
	"context"

	runtime "github.com/eventgen/runtime-go"
)

type InMemoryReceivedRecord struct {
	Event        runtime.EventEnvelope
	Attempts     int
	Acked        bool
	DeadLettered bool
}

type InMemoryMessageSource struct {
	Messages    []*InMemoryReceivedRecord
	DeadLetters []*InMemoryReceivedRecord
}

func NewInMemoryMessageSource(envelopes ...runtime.EventEnvelope) *InMemoryMessageSource {
	source := &InMemoryMessageSource{}
	for _, envelope := range envelopes {
		source.Enqueue(envelope)
	}
	return source
}

func (s *InMemoryMessageSource) Enqueue(envelope runtime.EventEnvelope) {
	s.Messages = append(s.Messages, &InMemoryReceivedRecord{Event: envelope})
}

func (s *InMemoryMessageSource) Receive(_ context.Context, opts runtime.ReceiveOptions) ([]runtime.ReceivedMessage, error) {
	maxMessages := opts.MaxMessages
	if maxMessages <= 0 {
		maxMessages = 1
	}
	messages := make([]runtime.ReceivedMessage, 0, maxMessages)
	for _, record := range s.Messages {
		if len(messages) == maxMessages {
			break
		}
		if record.Acked || record.DeadLettered {
			continue
		}
		record.Attempts++
		messages = append(messages, &inMemoryReceivedMessage{source: s, record: record})
	}
	return messages, nil
}

func (s *InMemoryMessageSource) Close(_ context.Context) error { return nil }

type inMemoryReceivedMessage struct {
	source *InMemoryMessageSource
	record *InMemoryReceivedRecord
}

func (m *inMemoryReceivedMessage) Envelope() runtime.EventEnvelope { return m.record.Event }
func (m *inMemoryReceivedMessage) Raw() any                        { return m.record }
func (m *inMemoryReceivedMessage) Attributes() map[string]any      { return nil }
func (m *inMemoryReceivedMessage) Ack(_ context.Context) error {
	m.record.Acked = true
	return nil
}
func (m *inMemoryReceivedMessage) Retry(_ context.Context, _ error) error { return nil }
func (m *inMemoryReceivedMessage) DeadLetter(_ context.Context, _ error) error {
	m.record.DeadLettered = true
	m.source.DeadLetters = append(m.source.DeadLetters, m.record)
	return nil
}
