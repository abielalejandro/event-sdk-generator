from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime, timezone
import uuid
from eventgen_runtime.types import EventEnvelope, PublishResult, TransportAdapter


@dataclass
class RecordedEvent:
    envelope: EventEnvelope
    published_at: datetime


class InMemoryTransportAdapter:
    def __init__(self) -> None:
        self.published: list[RecordedEvent] = []

    async def publish(self, envelope: EventEnvelope) -> PublishResult:
        self.published.append(RecordedEvent(envelope=envelope, published_at=datetime.now(timezone.utc)))
        return PublishResult(message_id=str(uuid.uuid4()))

    def clear(self) -> None:
        self.published.clear()
