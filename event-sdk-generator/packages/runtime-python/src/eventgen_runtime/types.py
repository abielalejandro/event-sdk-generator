from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Protocol, runtime_checkable


@dataclass
class EventMetadata:
    created_at: str
    trace_id: str


@dataclass
class EventEnvelope:
    event_id: str
    version: str
    payload: Any
    metadata: EventMetadata


@dataclass
class PublishResult:
    message_id: str | None = None


@runtime_checkable
class TransportAdapter(Protocol):
    async def publish(self, envelope: EventEnvelope) -> PublishResult: ...
