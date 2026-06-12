package adapters

import (
	"context"
	"sync"
	"time"

	runtime "github.com/eventgen/runtime-go"
	"github.com/google/uuid"
)

// RecordedEvent stores an envelope and its publish timestamp.
type RecordedEvent struct {
	Envelope    runtime.EventEnvelope
	PublishedAt time.Time
}

// InMemoryTransportAdapter accumulates published events in memory (useful for tests).
type InMemoryTransportAdapter struct {
	mu        sync.Mutex
	Published []RecordedEvent
}

func (a *InMemoryTransportAdapter) Publish(_ context.Context, envelope runtime.EventEnvelope) (*runtime.PublishResult, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.Published = append(a.Published, RecordedEvent{Envelope: envelope, PublishedAt: time.Now()})
	return &runtime.PublishResult{MessageID: uuid.NewString()}, nil
}

func (a *InMemoryTransportAdapter) Clear() {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.Published = nil
}
