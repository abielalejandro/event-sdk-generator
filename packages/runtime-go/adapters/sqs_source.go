package adapters

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
	sqstypes "github.com/aws/aws-sdk-go-v2/service/sqs/types"
	runtime "github.com/eventgen/runtime-go"
)

type SqsMessageSource struct {
	client                   *sqs.Client
	queueURL                 string
	waitTimeSeconds          int32
	visibilityTimeoutSeconds int32
}

func NewSqsMessageSource(ctx context.Context, queueURL string, optFns ...func(*config.LoadOptions) error) (*SqsMessageSource, error) {
	cfg, err := config.LoadDefaultConfig(ctx, optFns...)
	if err != nil {
		return nil, fmt.Errorf("sqs source: load config: %w", err)
	}
	return NewSqsMessageSourceWithClient(sqs.NewFromConfig(cfg), queueURL), nil
}

func NewSqsMessageSourceWithClient(client *sqs.Client, queueURL string) *SqsMessageSource {
	return &SqsMessageSource{client: client, queueURL: queueURL, waitTimeSeconds: 20}
}

func (s *SqsMessageSource) Receive(ctx context.Context, opts runtime.ReceiveOptions) ([]runtime.ReceivedMessage, error) {
	maxMessages := int32(opts.MaxMessages)
	if maxMessages <= 0 {
		maxMessages = 1
	}
	if maxMessages > 10 {
		maxMessages = 10
	}
	input := &sqs.ReceiveMessageInput{
		QueueUrl:              aws.String(s.queueURL),
		MaxNumberOfMessages:   maxMessages,
		WaitTimeSeconds:       s.waitTimeSeconds,
		MessageAttributeNames: []string{"All"},
		AttributeNames:        []sqstypes.QueueAttributeName{sqstypes.QueueAttributeNameAll},
	}
	if s.visibilityTimeoutSeconds > 0 {
		input.VisibilityTimeout = s.visibilityTimeoutSeconds
	}
	out, err := s.client.ReceiveMessage(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("sqs source: receive: %w", err)
	}
	messages := make([]runtime.ReceivedMessage, 0, len(out.Messages))
	for _, message := range out.Messages {
		var envelope runtime.EventEnvelope
		if err := json.Unmarshal([]byte(aws.ToString(message.Body)), &envelope); err != nil {
			return nil, fmt.Errorf("sqs source: unmarshal envelope: %w", err)
		}
		messages = append(messages, &sqsReceivedMessage{source: s, message: message, envelope: envelope})
	}
	return messages, nil
}

func (s *SqsMessageSource) Close(_ context.Context) error { return nil }

type sqsReceivedMessage struct {
	source   *SqsMessageSource
	message  sqstypes.Message
	envelope runtime.EventEnvelope
}

func (m *sqsReceivedMessage) Envelope() runtime.EventEnvelope { return m.envelope }
func (m *sqsReceivedMessage) Raw() any                        { return m.message }
func (m *sqsReceivedMessage) Attributes() map[string]any {
	return map[string]any{
		"messageId":         aws.ToString(m.message.MessageId),
		"attributes":        m.message.Attributes,
		"messageAttributes": m.message.MessageAttributes,
	}
}
func (m *sqsReceivedMessage) Ack(ctx context.Context) error {
	_, err := m.source.client.DeleteMessage(ctx, &sqs.DeleteMessageInput{
		QueueUrl:      aws.String(m.source.queueURL),
		ReceiptHandle: m.message.ReceiptHandle,
	})
	return err
}
func (m *sqsReceivedMessage) Retry(ctx context.Context, _ error) error {
	_, err := m.source.client.ChangeMessageVisibility(ctx, &sqs.ChangeMessageVisibilityInput{
		QueueUrl:          aws.String(m.source.queueURL),
		ReceiptHandle:     m.message.ReceiptHandle,
		VisibilityTimeout: 0,
	})
	return err
}
func (m *sqsReceivedMessage) DeadLetter(ctx context.Context, err error) error {
	return m.Retry(ctx, err)
}
