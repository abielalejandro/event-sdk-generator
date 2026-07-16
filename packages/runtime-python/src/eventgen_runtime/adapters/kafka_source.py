from __future__ import annotations

import json
from typing import Any

from eventgen_runtime.types import EventEnvelope, EventMetadata, ReceiveOptions


class _KafkaReceivedMessage:
    def __init__(self, source: "KafkaMessageSource", record: Any, envelope: EventEnvelope) -> None:
        self.envelope = envelope
        self.raw = record
        self.attributes = {
            "topic": record.topic,
            "partition": record.partition,
            "offset": record.offset,
            "headers": record.headers,
        }
        self._source = source
        self._record = record

    async def ack(self) -> None:
        consumer = await self._source.get_consumer()
        await consumer.commit({
            self._record.topic: {
                self._record.partition: self._record.offset + 1,
            }
        })

    async def retry(self, error: Any | None = None) -> None:
        return None

    async def dead_letter(self, error: Any | None = None) -> None:
        await self.retry(error)


class KafkaMessageSource:
    def __init__(
        self,
        topic: str,
        bootstrap_servers: str | list[str],
        group_id: str,
        client_id: str = "eventgen",
    ) -> None:
        self._topic = topic
        self._bootstrap_servers = bootstrap_servers if isinstance(bootstrap_servers, str) else ",".join(bootstrap_servers)
        self._group_id = group_id
        self._client_id = client_id
        self._consumer = None

    async def get_consumer(self):
        if self._consumer is None:
            from aiokafka import AIOKafkaConsumer  # type: ignore[import]

            self._consumer = AIOKafkaConsumer(
                self._topic,
                bootstrap_servers=self._bootstrap_servers,
                group_id=self._group_id,
                client_id=self._client_id,
                enable_auto_commit=False,
            )
            await self._consumer.start()
        return self._consumer

    async def receive(self, options: ReceiveOptions | None = None) -> list[_KafkaReceivedMessage]:
        consumer = await self.get_consumer()
        max_messages = max(1, options.max_messages if options and options.max_messages else 1)
        batch = await consumer.getmany(max_records=max_messages, timeout_ms=1000)
        messages: list[_KafkaReceivedMessage] = []
        for records in batch.values():
            for record in records:
                messages.append(_KafkaReceivedMessage(self, record, _parse_envelope(record.value)))
        return messages

    async def close(self) -> None:
        if self._consumer is not None:
            await self._consumer.stop()
            self._consumer = None


def _parse_envelope(value: bytes | bytearray | str) -> EventEnvelope:
    raw = value.decode("utf-8") if isinstance(value, (bytes, bytearray)) else value
    data = json.loads(raw)
    metadata = data["metadata"]
    return EventEnvelope(
        event_id=data["eventId"],
        version=data["version"],
        payload=data["payload"],
        metadata=EventMetadata(
            created_at=metadata["createdAt"],
            trace_id=metadata["traceId"],
            fifo=metadata.get("fifo"),
        ),
    )
