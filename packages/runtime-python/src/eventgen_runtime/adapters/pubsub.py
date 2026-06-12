from __future__ import annotations
import json
from eventgen_runtime.types import EventEnvelope, PublishResult


class PubSubTransportAdapter:
    def __init__(self, project_id: str, topic_name: str) -> None:
        self._project_id = project_id
        self._topic_name = topic_name

    async def publish(self, envelope: EventEnvelope) -> PublishResult:
        from google.cloud import pubsub_v1  # type: ignore[import]
        import asyncio
        publisher = pubsub_v1.PublisherClient()
        topic_path = publisher.topic_path(self._project_id, self._topic_name)
        data = json.dumps(envelope.__dict__, default=str).encode("utf-8")
        future = publisher.publish(
            topic_path,
            data,
            eventId=envelope.event_id,
            version=envelope.version,
            traceId=envelope.metadata.trace_id,
        )
        message_id = await asyncio.get_event_loop().run_in_executor(None, future.result)
        return PublishResult(message_id=message_id)
