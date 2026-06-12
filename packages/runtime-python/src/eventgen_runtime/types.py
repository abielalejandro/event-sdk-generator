from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Protocol, runtime_checkable


@dataclass
class FifoOptions:
    """FIFO options for ordered delivery in SQS FIFO queues and SNS FIFO topics."""
    message_group_id: str
    deduplication_id: str | None = None


@dataclass
class EventMetadata:
    created_at: str
    trace_id: str
    fifo: FifoOptions | None = None


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
