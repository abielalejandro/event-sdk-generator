from __future__ import annotations
import json
from eventgen_runtime.types import EventEnvelope, PublishResult


class ServiceBusTransportAdapter:
    def __init__(self, connection_string: str, name: str) -> None:
        self._connection_string = connection_string
        self._name = name

    async def publish(self, envelope: EventEnvelope) -> PublishResult:
        from azure.servicebus.aio import ServiceBusClient  # type: ignore[import]
        from azure.servicebus import ServiceBusMessage  # type: ignore[import]
        body = json.dumps(envelope.__dict__, default=str)
        message = ServiceBusMessage(
            body,
            content_type="application/json",
            application_properties={
                "eventId": envelope.event_id,
                "version": envelope.version,
                "traceId": envelope.metadata.trace_id,
            },
        )
        async with ServiceBusClient.from_connection_string(self._connection_string) as client:
            async with client.get_queue_sender(self._name) as sender:
                await sender.send_messages(message)
        return PublishResult(message_id=message.message_id)
