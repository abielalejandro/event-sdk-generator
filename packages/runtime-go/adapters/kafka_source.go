package adapters

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/IBM/sarama"
	runtime "github.com/eventgen/runtime-go"
)

type KafkaMessageSource struct {
	group    sarama.ConsumerGroup
	topic    string
	messages chan runtime.ReceivedMessage
	cancel   context.CancelFunc
}

func NewKafkaMessageSource(brokers []string, topic, groupID string, cfg *sarama.Config) (*KafkaMessageSource, error) {
	if cfg == nil {
		cfg = sarama.NewConfig()
		cfg.Consumer.Offsets.Initial = sarama.OffsetNewest
	}
	group, err := sarama.NewConsumerGroup(brokers, groupID, cfg)
	if err != nil {
		return nil, fmt.Errorf("kafka source: new consumer group: %w", err)
	}
	return &KafkaMessageSource{group: group, topic: topic, messages: make(chan runtime.ReceivedMessage, 100)}, nil
}

func (s *KafkaMessageSource) Receive(ctx context.Context, opts runtime.ReceiveOptions) ([]runtime.ReceivedMessage, error) {
	if s.cancel == nil {
		consumeCtx, cancel := context.WithCancel(context.Background())
		s.cancel = cancel
		go s.consume(consumeCtx)
	}
	maxMessages := opts.MaxMessages
	if maxMessages <= 0 {
		maxMessages = 1
	}
	messages := make([]runtime.ReceivedMessage, 0, maxMessages)
	for len(messages) < maxMessages {
		select {
		case <-ctx.Done():
			return messages, ctx.Err()
		case message := <-s.messages:
			messages = append(messages, message)
		default:
			return messages, nil
		}
	}
	return messages, nil
}

func (s *KafkaMessageSource) Close(_ context.Context) error {
	if s.cancel != nil {
		s.cancel()
		s.cancel = nil
	}
	return s.group.Close()
}

func (s *KafkaMessageSource) consume(ctx context.Context) {
	handler := &kafkaConsumerGroupHandler{messages: s.messages}
	for ctx.Err() == nil {
		_ = s.group.Consume(ctx, []string{s.topic}, handler)
	}
}

type kafkaConsumerGroupHandler struct {
	messages chan<- runtime.ReceivedMessage
}

func (h *kafkaConsumerGroupHandler) Setup(sarama.ConsumerGroupSession) error   { return nil }
func (h *kafkaConsumerGroupHandler) Cleanup(sarama.ConsumerGroupSession) error { return nil }
func (h *kafkaConsumerGroupHandler) ConsumeClaim(session sarama.ConsumerGroupSession, claim sarama.ConsumerGroupClaim) error {
	for message := range claim.Messages() {
		var envelope runtime.EventEnvelope
		if err := json.Unmarshal(message.Value, &envelope); err != nil {
			continue
		}
		h.messages <- &kafkaReceivedMessage{session: session, message: message, envelope: envelope}
	}
	return nil
}

type kafkaReceivedMessage struct {
	session  sarama.ConsumerGroupSession
	message  *sarama.ConsumerMessage
	envelope runtime.EventEnvelope
}

func (m *kafkaReceivedMessage) Envelope() runtime.EventEnvelope { return m.envelope }
func (m *kafkaReceivedMessage) Raw() any                        { return m.message }
func (m *kafkaReceivedMessage) Attributes() map[string]any {
	return map[string]any{
		"topic":     m.message.Topic,
		"partition": m.message.Partition,
		"offset":    m.message.Offset,
		"headers":   m.message.Headers,
	}
}
func (m *kafkaReceivedMessage) Ack(_ context.Context) error {
	m.session.MarkMessage(m.message, "")
	return nil
}
func (m *kafkaReceivedMessage) Retry(_ context.Context, _ error) error { return nil }
func (m *kafkaReceivedMessage) DeadLetter(ctx context.Context, err error) error {
	return m.Retry(ctx, err)
}
