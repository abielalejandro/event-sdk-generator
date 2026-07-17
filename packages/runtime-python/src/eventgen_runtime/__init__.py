from __future__ import annotations
import uuid
from datetime import datetime, timezone

from eventgen_runtime.types import (
    EventEnvelope,
    EventMetadata,
    PublishResult,
    TransportAdapter,
    FifoOptions,
    MessageSource,
    ReceivedMessage,
    ReceiveOptions,
    EventConsumer,
    MessageAction,
)
from eventgen_runtime.consumer_runner import ConsumerRunner, ConsumerRunnerOptions, run_consumer
from eventgen_runtime.adapters.memory import InMemoryTransportAdapter
from eventgen_runtime.adapters.message_memory import InMemoryMessageSource
from eventgen_runtime.middleware.retry import with_retry
from eventgen_runtime.middleware.logging import with_logging

__all__ = [
    "EventEnvelope",
    "EventMetadata",
    "FifoOptions",
    "PublishResult",
    "TransportAdapter",
    "MessageSource",
    "ReceivedMessage",
    "ReceiveOptions",
    "EventConsumer",
    "MessageAction",
    "ConsumerRunner",
    "ConsumerRunnerOptions",
    "run_consumer",
    "InMemoryTransportAdapter",
    "InMemoryMessageSource",
    "with_retry",
    "with_logging",
    "build_envelope",
    # Cloud adapters (imported lazily via their own modules)
    "SnsTransportAdapter",
    "SqsTransportAdapter",
    "SqsMessageSource",
    "EventBridgeTransportAdapter",
    "PubSubTransportAdapter",
    "ServiceBusTransportAdapter",
    "KafkaTransportAdapter",
    "KafkaMessageSource",
    "RabbitMQTransportAdapter",
]


def build_envelope(
    event_id: str,
    version: str,
    payload: object,
    trace_id: str | None = None,
    fifo: FifoOptions | None = None,
) -> EventEnvelope:
    return EventEnvelope(
        event_id=event_id,
        version=version,
        payload=payload,
        metadata=EventMetadata(
            created_at=datetime.now(timezone.utc).isoformat(),
            trace_id=trace_id or str(uuid.uuid4()),
            fifo=fifo,
        ),
    )


def __getattr__(name: str):
    if name == "SnsTransportAdapter":
        from eventgen_runtime.adapters.sns import SnsTransportAdapter
        return SnsTransportAdapter
    if name == "SqsTransportAdapter":
        from eventgen_runtime.adapters.sqs import SqsTransportAdapter
        return SqsTransportAdapter
    if name == "SqsMessageSource":
        from eventgen_runtime.adapters.sqs_source import SqsMessageSource
        return SqsMessageSource
    if name == "EventBridgeTransportAdapter":
        from eventgen_runtime.adapters.eventbridge import EventBridgeTransportAdapter
        return EventBridgeTransportAdapter
    if name == "PubSubTransportAdapter":
        from eventgen_runtime.adapters.pubsub import PubSubTransportAdapter
        return PubSubTransportAdapter
    if name == "ServiceBusTransportAdapter":
        from eventgen_runtime.adapters.servicebus import ServiceBusTransportAdapter
        return ServiceBusTransportAdapter
    if name == "KafkaTransportAdapter":
        from eventgen_runtime.adapters.kafka import KafkaTransportAdapter
        return KafkaTransportAdapter
    if name == "KafkaMessageSource":
        from eventgen_runtime.adapters.kafka_source import KafkaMessageSource
        return KafkaMessageSource
    if name == "RabbitMQTransportAdapter":
        from eventgen_runtime.adapters.rabbitmq import RabbitMQTransportAdapter
        return RabbitMQTransportAdapter
    raise AttributeError(f"module 'eventgen_runtime' has no attribute {name!r}")
