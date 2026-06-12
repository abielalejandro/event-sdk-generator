package middleware

import (
	"context"
	"fmt"
	"time"

	runtime "github.com/eventgen/runtime-go"
)

type RetryOptions struct {
	MaxAttempts int
	DelayMs     int
	Backoff     string // "fixed" or "exponential"
}

type retryAdapter struct {
	inner runtime.TransportAdapter
	opts  RetryOptions
}

// WithRetry wraps an adapter with automatic retry on failure.
func WithRetry(adapter runtime.TransportAdapter, opts RetryOptions) runtime.TransportAdapter {
	if opts.MaxAttempts <= 0 {
		opts.MaxAttempts = 3
	}
	if opts.DelayMs <= 0 {
		opts.DelayMs = 200
	}
	if opts.Backoff == "" {
		opts.Backoff = "exponential"
	}
	return &retryAdapter{inner: adapter, opts: opts}
}

func (r *retryAdapter) Publish(ctx context.Context, envelope runtime.EventEnvelope) (*runtime.PublishResult, error) {
	var lastErr error
	for attempt := 1; attempt <= r.opts.MaxAttempts; attempt++ {
		result, err := r.inner.Publish(ctx, envelope)
		if err == nil {
			return result, nil
		}
		lastErr = err
		if attempt < r.opts.MaxAttempts {
			delay := time.Duration(r.opts.DelayMs) * time.Millisecond
			if r.opts.Backoff == "exponential" {
				delay = delay * (1 << (attempt - 1))
			}
			select {
			case <-ctx.Done():
				return nil, fmt.Errorf("retry: context cancelled: %w", ctx.Err())
			case <-time.After(delay):
			}
		}
	}
	return nil, fmt.Errorf("retry: exhausted %d attempts: %w", r.opts.MaxAttempts, lastErr)
}
