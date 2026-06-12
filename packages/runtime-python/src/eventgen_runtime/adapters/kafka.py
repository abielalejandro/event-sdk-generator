from __future__ import annotations
import json
from eventgen_runtime.types import EventEnvelope, PublishResult


class KafkaTransportAdapter:
    def __init__(self, topic: str, bootstrap_servers: str | list[str], client_id: str = "eventgen") -> None:
        self._topic = topic
        self._bootstrap_servers = bootstrap_servers if isinstance(bootstrap_servers, str) else ",".join(bootstrap_servers)
        self._client_id = client_id
        self._producer = None

    async def _get_producer(self):
        if self._producer is None:
            from aiokafka import AIOKafkaProducer  # type: ignore[import]
            self._producer = AIOKafkaProducer(
                bootstrap_servers=self._bootstrap_servers,
                client_id=self._client_id,
            )
            await self._producer.start()
        return self._producer

    async def publish(self, envelope: EventEnvelope) -> PublishResult:
        producer = await self._get_producer()
        value = json.dumps(envelope.__dict__, default=str).encode("utf-8")
        headers = [
            ("eventId", envelope.event_id.encode()),
            ("version", envelope.version.encode()),
            ("traceId", envelope.metadata.trace_id.encode()),
        ]
        record = await producer.send_and_wait(
            self._topic,
            value=value,
            key=envelope.event_id.encode(),
            headers=headers,
        )
        return PublishResult(message_id=f"{record.partition}-{record.offset}")

    async def disconnect(self) -> None:
        if self._producer:
            await self._producer.stop()
            self._producer = None
