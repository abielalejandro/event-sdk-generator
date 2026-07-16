from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Literal, Protocol, runtime_checkable


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


@dataclass
class ReceiveOptions:
    max_messages: int | None = None


MessageAction = Literal["ack", "retry", "dead_letter", "ignore"]


@runtime_checkable
class ReceivedMessage(Protocol):
    envelope: EventEnvelope
    raw: Any
    attributes: dict[str, Any] | None

    async def ack(self) -> None: ...
    async def retry(self, error: Any | None = None) -> None: ...
    async def dead_letter(self, error: Any | None = None) -> None: ...


@runtime_checkable
class MessageSource(Protocol):
    async def receive(self, options: ReceiveOptions | None = None) -> list[ReceivedMessage]: ...
    async def close(self) -> None: ...


@runtime_checkable
class EventConsumer(Protocol):
    async def handle(self, envelope: EventEnvelope) -> bool: ...


ErrorHook = Callable[[Any, ReceivedMessage | None], Awaitable[None] | None]
