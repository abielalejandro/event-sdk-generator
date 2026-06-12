package runtime

import "context"

// EventMetadata carries observability fields attached to every published event.
type EventMetadata struct {
	CreatedAt string `json:"createdAt"`
	TraceID   string `json:"traceId"`
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
}

// PublishOption is a functional option for Publish calls.
type PublishOption func(*PublishOptions)

// WithTraceID injects a custom trace ID into the envelope metadata.
func WithTraceID(id string) PublishOption {
	return func(o *PublishOptions) { o.TraceID = id }
}
