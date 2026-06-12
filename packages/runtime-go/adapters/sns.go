package adapters

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/sns"
	"github.com/aws/aws-sdk-go-v2/service/sns/types"
	runtime "github.com/eventgen/runtime-go"
)

type SnsTransportAdapter struct {
	client   *sns.Client
	topicArn string
}

func NewSnsTransportAdapter(ctx context.Context, topicArn string, optFns ...func(*config.LoadOptions) error) (*SnsTransportAdapter, error) {
	cfg, err := config.LoadDefaultConfig(ctx, optFns...)
	if err != nil {
		return nil, fmt.Errorf("sns adapter: load config: %w", err)
	}
	return &SnsTransportAdapter{client: sns.NewFromConfig(cfg), topicArn: topicArn}, nil
}

func NewSnsTransportAdapterWithClient(client *sns.Client, topicArn string) *SnsTransportAdapter {
	return &SnsTransportAdapter{client: client, topicArn: topicArn}
}

func (a *SnsTransportAdapter) Publish(ctx context.Context, envelope runtime.EventEnvelope) (*runtime.PublishResult, error) {
	body, err := json.Marshal(envelope)
	if err != nil {
		return nil, fmt.Errorf("sns adapter: marshal envelope: %w", err)
	}
	input := &sns.PublishInput{
		TopicArn: aws.String(a.topicArn),
		Message:  aws.String(string(body)),
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
	out, err := a.client.Publish(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("sns adapter: publish %s: %w", envelope.EventID, err)
	}
	return &runtime.PublishResult{MessageID: aws.ToString(out.MessageId)}, nil
}
