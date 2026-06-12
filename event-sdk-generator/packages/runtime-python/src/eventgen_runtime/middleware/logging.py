from __future__ import annotations
import logging
import time
from eventgen_runtime.types import EventEnvelope, PublishResult, TransportAdapter

_default_logger = logging.getLogger("eventgen")


def with_logging(adapter: TransportAdapter, logger: logging.Logger = _default_logger) -> TransportAdapter:
    class _LoggingAdapter:
        async def publish(self, envelope: EventEnvelope) -> PublishResult:
            start = time.monotonic()
            logger.info("publishing event", extra={"event_id": envelope.event_id, "trace_id": envelope.metadata.trace_id})
            try:
                result = await adapter.publish(envelope)
                duration_ms = int((time.monotonic() - start) * 1000)
                logger.info("event published", extra={"event_id": envelope.event_id, "message_id": result.message_id, "duration_ms": duration_ms})
                return result
            except Exception as e:
                duration_ms = int((time.monotonic() - start) * 1000)
                logger.error("event publish failed", extra={"event_id": envelope.event_id, "error": str(e), "duration_ms": duration_ms})
                raise

    return _LoggingAdapter()  # type: ignore[return-value]
