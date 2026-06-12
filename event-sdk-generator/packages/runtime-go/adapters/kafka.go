package adapters

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/IBM/sarama"
	runtime "github.com/eventgen/runtime-go"
)

type KafkaTransportAdapter struct {
	producer sarama.SyncProducer
	topic    string
}

func NewKafkaTransportAdapter(brokers []string, topic string, cfg *sarama.Config) (*KafkaTransportAdapter, error) {
	if cfg == nil {
		cfg = sarama.NewConfig()
		cfg.Producer.Return.Successes = true
		cfg.Producer.RequiredAcks = sarama.WaitForAll
	}
	producer, err := sarama.NewSyncProducer(brokers, cfg)
	if err != nil {
		return nil, fmt.Errorf("kafka adapter: new producer: %w", err)
	}
	return &KafkaTransportAdapter{producer: producer, topic: topic}, nil
}

func NewKafkaTransportAdapterWithProducer(producer sarama.SyncProducer, topic string) *KafkaTransportAdapter {
	return &KafkaTransportAdapter{producer: producer, topic: topic}
}

func (a *KafkaTransportAdapter) Publish(_ context.Context, envelope runtime.EventEnvelope) (*runtime.PublishResult, error) {
	value, err := json.Marshal(envelope)
	if err != nil {
		return nil, fmt.Errorf("kafka adapter: marshal envelope: %w", err)
	}
	msg := &sarama.ProducerMessage{
		Topic: a.topic,
		Key:   sarama.StringEncoder(envelope.EventID),
		Value: sarama.ByteEncoder(value),
		Headers: []sarama.RecordHeader{
			{Key: []byte("eventId"), Value: []byte(envelope.EventID)},
			{Key: []byte("version"), Value: []byte(envelope.Version)},
			{Key: []byte("traceId"), Value: []byte(envelope.Metadata.TraceID)},
		},
	}
	partition, offset, err := a.producer.SendMessage(msg)
	if err != nil {
		return nil, fmt.Errorf("kafka adapter: send %s: %w", envelope.EventID, err)
	}
	return &runtime.PublishResult{MessageID: fmt.Sprintf("%d-%d", partition, offset)}, nil
}

func (a *KafkaTransportAdapter) Close() error {
	return a.producer.Close()
}
