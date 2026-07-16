from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from eventgen_runtime.types import EventEnvelope, ReceiveOptions


@dataclass
class InMemoryReceivedRecord:
    envelope: EventEnvelope
    attempts: int = 0
    acked: bool = False
    dead_lettered: bool = False


class _InMemoryReceivedMessage:
    def __init__(self, record: InMemoryReceivedRecord, source: "InMemoryMessageSource") -> None:
        self.envelope = record.envelope
        self.raw = record
        self.attributes: dict[str, Any] | None = None
        self._record = record
        self._source = source

    async def ack(self) -> None:
        self._record.acked = True

    async def retry(self, error: Any | None = None) -> None:
        return None

    async def dead_letter(self, error: Any | None = None) -> None:
        self._record.dead_lettered = True
        self._source.dead_letters.append(self._record)


class InMemoryMessageSource:
    def __init__(self, envelopes: list[EventEnvelope] | None = None) -> None:
        self.messages = [InMemoryReceivedRecord(envelope=envelope) for envelope in envelopes or []]
        self.dead_letters: list[InMemoryReceivedRecord] = []

    def enqueue(self, envelope: EventEnvelope) -> None:
        self.messages.append(InMemoryReceivedRecord(envelope=envelope))

    async def receive(self, options: ReceiveOptions | None = None) -> list[_InMemoryReceivedMessage]:
        max_messages = max(1, options.max_messages if options and options.max_messages else 1)
        records = [record for record in self.messages if not record.acked and not record.dead_lettered][:max_messages]
        for record in records:
            record.attempts += 1
        return [_InMemoryReceivedMessage(record, self) for record in records]

    async def close(self) -> None:
        return None

    def clear(self) -> None:
        self.messages.clear()
        self.dead_letters.clear()
