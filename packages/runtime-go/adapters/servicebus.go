package adapters

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/Azure/azure-sdk-for-go/sdk/messaging/azservicebus"
	runtime "github.com/eventgen/runtime-go"
	"github.com/google/uuid"
)

type ServiceBusTransportAdapter struct {
	sender *azservicebus.Sender
}

func NewServiceBusTransportAdapter(connectionString, queueOrTopicName string) (*ServiceBusTransportAdapter, error) {
	client, err := azservicebus.NewClientFromConnectionString(connectionString, nil)
	if err != nil {
		return nil, fmt.Errorf("servicebus adapter: new client: %w", err)
	}
	sender, err := client.NewSender(queueOrTopicName, nil)
	if err != nil {
		return nil, fmt.Errorf("servicebus adapter: new sender: %w", err)
	}
	return &ServiceBusTransportAdapter{sender: sender}, nil
}

func NewServiceBusTransportAdapterWithSender(sender *azservicebus.Sender) *ServiceBusTransportAdapter {
	return &ServiceBusTransportAdapter{sender: sender}
}

func (a *ServiceBusTransportAdapter) Publish(ctx context.Context, envelope runtime.EventEnvelope) (*runtime.PublishResult, error) {
	body, err := json.Marshal(envelope)
	if err != nil {
		return nil, fmt.Errorf("servicebus adapter: marshal envelope: %w", err)
	}
	msgID := uuid.NewString()
	msg := &azservicebus.Message{
		Body:      body,
		MessageID: &msgID,
		ContentType: func() *string { s := "application/json"; return &s }(),
		ApplicationProperties: map[string]any{
			"eventId": envelope.EventID,
			"version": envelope.Version,
			"traceId": envelope.Metadata.TraceID,
		},
	}
	if err := a.sender.SendMessage(ctx, msg, nil); err != nil {
		return nil, fmt.Errorf("servicebus adapter: send %s: %w", envelope.EventID, err)
	}
	return &runtime.PublishResult{MessageID: msgID}, nil
}

func (a *ServiceBusTransportAdapter) Close(ctx context.Context) error {
	return a.sender.Close(ctx)
}
