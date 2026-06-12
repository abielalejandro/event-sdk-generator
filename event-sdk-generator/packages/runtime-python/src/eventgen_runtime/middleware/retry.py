from __future__ import annotations
import asyncio
from eventgen_runtime.types import EventEnvelope, PublishResult, TransportAdapter


def with_retry(
    adapter: TransportAdapter,
    max_attempts: int = 3,
    delay_ms: int = 200,
    backoff: str = "exponential",
) -> TransportAdapter:
    class _RetryAdapter:
        async def publish(self, envelope: EventEnvelope) -> PublishResult:
            last_error: BaseException | None = None
            for attempt in range(1, max_attempts + 1):
                try:
                    return await adapter.publish(envelope)
                except Exception as e:
                    last_error = e
                    if attempt < max_attempts:
                        wait = (delay_ms * (2 ** (attempt - 1)) if backoff == "exponential" else delay_ms) / 1000
                        await asyncio.sleep(wait)
            raise last_error  # type: ignore[misc]

    return _RetryAdapter()  # type: ignore[return-value]
