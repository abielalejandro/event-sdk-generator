package runtime

import "context"

// FifoOptions enables ordered delivery in SQS FIFO queues and SNS FIFO topics.
type FifoOptions struct {
	// MessageGroupId groups messages for ordered delivery within the group.
	MessageGroupId string `json:"messageGroupId"`
	// DeduplicationId is the unique token for deduplication (5-minute window).
	// If empty, content-based deduplication must be enabled on the queue/topic.
	DeduplicationId string `json:"deduplicationId,omitempty"`
}

// WithFifo sets FIFO options on the publish call.
func WithFifo(opts FifoOptions) PublishOption {
	return func(o *PublishOptions) { o.Fifo = &opts }
}

// EventMetadata carries observability fields attached to every published event.
type EventMetadata struct {
	CreatedAt string       `json:"createdAt"`
	TraceID   string       `json:"traceId"`
	Fifo      *FifoOptions `json:"fifo,omitempty"`
}

// EventEnvelope wraps any event payload with its identity and metadata.
type EventEnvelope struct {
	EventID  string        `json:"eventId"`
	Version  string        `json:"version"`
	Payload  any           `json:"payload"`
	Metadata EventMetadata `json:"metadata"`
}

// PublishResult is returned after a successful publish.
type PublishResult struct {
	MessageID string
}

// TransportAdapter is the interface every adapter must implement.
type TransportAdapter interface {
	Publish(ctx context.Context, envelope EventEnvelope) (*PublishResult, error)
}

// PublishOptions holds optional publish-time parameters.
type PublishOptions struct {
	TraceID string
	Fifo    *FifoOptions
}

// PublishOption is a functional option for Publish calls.
type PublishOption func(*PublishOptions)

// WithTraceID injects a custom trace ID into the envelope metadata.
func WithTraceID(id string) PublishOption {
	return func(o *PublishOptions) { o.TraceID = id }
}
