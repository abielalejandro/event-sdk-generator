package adapters

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/eventbridge"
	"github.com/aws/aws-sdk-go-v2/service/eventbridge/types"
	runtime "github.com/eventgen/runtime-go"
)

type EventBridgeTransportAdapter struct {
	client       *eventbridge.Client
	eventBusName string
	source       string // defaults to envelope.EventID when empty
}

func NewEventBridgeTransportAdapter(ctx context.Context, eventBusName, source string, optFns ...func(*config.LoadOptions) error) (*EventBridgeTransportAdapter, error) {
	cfg, err := config.LoadDefaultConfig(ctx, optFns...)
	if err != nil {
		return nil, fmt.Errorf("eventbridge adapter: load config: %w", err)
	}
	return &EventBridgeTransportAdapter{client: eventbridge.NewFromConfig(cfg), eventBusName: eventBusName, source: source}, nil
}

func NewEventBridgeTransportAdapterWithClient(client *eventbridge.Client, eventBusName, source string) *EventBridgeTransportAdapter {
	return &EventBridgeTransportAdapter{client: client, eventBusName: eventBusName, source: source}
}

func (a *EventBridgeTransportAdapter) Publish(ctx context.Context, envelope runtime.EventEnvelope) (*runtime.PublishResult, error) {
	detail, err := json.Marshal(envelope)
	if err != nil {
		return nil, fmt.Errorf("eventbridge adapter: marshal envelope: %w", err)
	}
	src := a.source
	if src == "" {
		src = envelope.EventID
	}
	t, _ := time.Parse(time.RFC3339Nano, envelope.Metadata.CreatedAt)
	out, err := a.client.PutEvents(ctx, &eventbridge.PutEventsInput{
		Entries: []types.PutEventsRequestEntry{{
			EventBusName: aws.String(a.eventBusName),
			Source:       aws.String(src),
			DetailType:   aws.String(envelope.EventID),
			Detail:       aws.String(string(detail)),
			Time:         aws.Time(t),
		}},
	})
	if err != nil {
		return nil, fmt.Errorf("eventbridge adapter: put events %s: %w", envelope.EventID, err)
	}
	if out.FailedEntryCount > 0 {
		e := out.Entries[0]
		return nil, fmt.Errorf("eventbridge adapter: %s — %s", aws.ToString(e.ErrorCode), aws.ToString(e.ErrorMessage))
	}
	return &runtime.PublishResult{MessageID: aws.ToString(out.Entries[0].EventId)}, nil
}
