from __future__ import annotations
import json
import uuid
from eventgen_runtime.types import EventEnvelope, PublishResult


class RabbitMQTransportAdapter:
    def __init__(self, url: str, exchange: str, routing_key: str | None = None) -> None:
        self._url = url
        self._exchange = exchange
        self._routing_key = routing_key
        self._connection = None

    async def _get_channel(self):
        if self._connection is None:
            import aio_pika  # type: ignore[import]
            self._connection = await aio_pika.connect_robust(self._url)
        return await self._connection.channel()

    async def publish(self, envelope: EventEnvelope) -> PublishResult:
        import aio_pika  # type: ignore[import]
        channel = await self._get_channel()
        message_id = str(uuid.uuid4())
        body = json.dumps(envelope.__dict__, default=str).encode("utf-8")
        message = aio_pika.Message(
            body=body,
            content_type="application/json",
            message_id=message_id,
            headers={
                "eventId": envelope.event_id,
                "version": envelope.version,
                "traceId": envelope.metadata.trace_id,
            },
        )
        routing_key = self._routing_key or envelope.event_id
        await channel.default_exchange.publish(message, routing_key=routing_key)
        return PublishResult(message_id=message_id)

    async def close(self) -> None:
        if self._connection:
            await self._connection.close()
            self._connection = None
