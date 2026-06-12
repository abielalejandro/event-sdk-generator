package adapters

import (
	"context"
	"encoding/json"
	"fmt"

	"cloud.google.com/go/pubsub"
	runtime "github.com/eventgen/runtime-go"
)

type PubSubTransportAdapter struct {
	topic *pubsub.Topic
}

func NewPubSubTransportAdapter(ctx context.Context, projectID, topicID string) (*PubSubTransportAdapter, error) {
	client, err := pubsub.NewClient(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("pubsub adapter: new client: %w", err)
	}
	return &PubSubTransportAdapter{topic: client.Topic(topicID)}, nil
}

func NewPubSubTransportAdapterWithTopic(topic *pubsub.Topic) *PubSubTransportAdapter {
	return &PubSubTransportAdapter{topic: topic}
}

func (a *PubSubTransportAdapter) Publish(ctx context.Context, envelope runtime.EventEnvelope) (*runtime.PublishResult, error) {
	data, err := json.Marshal(envelope)
	if err != nil {
		return nil, fmt.Errorf("pubsub adapter: marshal envelope: %w", err)
	}
	result := a.topic.Publish(ctx, &pubsub.Message{
		Data: data,
		Attributes: map[string]string{
			"eventId": envelope.EventID,
			"version": envelope.Version,
			"traceId": envelope.Metadata.TraceID,
		},
	})
	id, err := result.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("pubsub adapter: publish %s: %w", envelope.EventID, err)
	}
	return &runtime.PublishResult{MessageID: id}, nil
}

func (a *PubSubTransportAdapter) Stop() {
	a.topic.Stop()
}
