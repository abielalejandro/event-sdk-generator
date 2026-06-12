package runtime

import (
	"time"

	"github.com/google/uuid"
)

// BuildEnvelope constructs an EventEnvelope with auto-generated metadata.
func BuildEnvelope(eventID, version string, payload any, opts ...PublishOption) EventEnvelope {
	o := &PublishOptions{}
	for _, opt := range opts {
		opt(o)
	}
	if o.TraceID == "" {
		o.TraceID = uuid.NewString()
	}
	return EventEnvelope{
		EventID: eventID,
		Version: version,
		Payload: payload,
		Metadata: EventMetadata{
			CreatedAt: time.Now().UTC().Format(time.RFC3339Nano),
			TraceID:   o.TraceID,
		},
	}
}
