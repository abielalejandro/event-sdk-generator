package adapters

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
	"github.com/aws/aws-sdk-go-v2/service/sqs/types"
	runtime "github.com/eventgen/runtime-go"
)

type SqsTransportAdapter struct {
	client   *sqs.Client
	queueURL string
}

func NewSqsTransportAdapter(ctx context.Context, queueURL string, optFns ...func(*config.LoadOptions) error) (*SqsTransportAdapter, error) {
	cfg, err := config.LoadDefaultConfig(ctx, optFns...)
	if err != nil {
		return nil, fmt.Errorf("sqs adapter: load config: %w", err)
	}
	return &SqsTransportAdapter{client: sqs.NewFromConfig(cfg), queueURL: queueURL}, nil
}

func NewSqsTransportAdapterWithClient(client *sqs.Client, queueURL string) *SqsTransportAdapter {
	return &SqsTransportAdapter{client: client, queueURL: queueURL}
}

func (a *SqsTransportAdapter) Publish(ctx context.Context, envelope runtime.EventEnvelope) (*runtime.PublishResult, error) {
	body, err := json.Marshal(envelope)
	if err != nil {
		return nil, fmt.Errorf("sqs adapter: marshal envelope: %w", err)
	}
	input := &sqs.SendMessageInput{
		QueueUrl:    aws.String(a.queueURL),
		MessageBody: aws.String(string(body)),
		MessageAttributes: map[string]types.MessageAttributeValue{
			"eventId": {DataType: aws.String("String"), StringValue: aws.String(envelope.EventID)},
			"version": {DataType: aws.String("String"), StringValue: aws.String(envelope.Version)},
		},
	}
	if f := envelope.Metadata.Fifo; f != nil {
		input.MessageGroupId = aws.String(f.MessageGroupId)
		if f.DeduplicationId != "" {
			input.MessageDeduplicationId = aws.String(f.DeduplicationId)
		}
	}
	out, err := a.client.SendMessage(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("sqs adapter: send %s: %w", envelope.EventID, err)
	}
	return &runtime.PublishResult{MessageID: aws.ToString(out.MessageId)}, nil
}
