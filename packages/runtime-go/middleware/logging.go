package middleware

import (
	"context"
	"log/slog"
	"time"

	runtime "github.com/eventgen/runtime-go"
)

type loggingAdapter struct {
	inner  runtime.TransportAdapter
	logger *slog.Logger
}

// WithLogging wraps an adapter with structured logging via slog.
func WithLogging(adapter runtime.TransportAdapter, logger *slog.Logger) runtime.TransportAdapter {
	if logger == nil {
		logger = slog.Default()
	}
	return &loggingAdapter{inner: adapter, logger: logger}
}

func (l *loggingAdapter) Publish(ctx context.Context, envelope runtime.EventEnvelope) (*runtime.PublishResult, error) {
	start := time.Now()
	l.logger.InfoContext(ctx, "publishing event",
		slog.String("eventId", envelope.EventID),
		slog.String("traceId", envelope.Metadata.TraceID),
	)
	result, err := l.inner.Publish(ctx, envelope)
	durationMs := time.Since(start).Milliseconds()
	if err != nil {
		l.logger.ErrorContext(ctx, "event publish failed",
			slog.String("eventId", envelope.EventID),
			slog.String("error", err.Error()),
			slog.Int64("durationMs", durationMs),
		)
		return nil, err
	}
	l.logger.InfoContext(ctx, "event published",
		slog.String("eventId", envelope.EventID),
		slog.String("messageId", result.MessageID),
		slog.Int64("durationMs", durationMs),
	)
	return result, nil
}
