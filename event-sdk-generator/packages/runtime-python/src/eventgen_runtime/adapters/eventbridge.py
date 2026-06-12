from __future__ import annotations
import json
import os
from eventgen_runtime.types import EventEnvelope, PublishResult


class EventBridgeTransportAdapter:
    def __init__(self, event_bus_name: str, source: str | None = None, region: str | None = None) -> None:
        self._event_bus_name = event_bus_name
        self._source = source
        self._region = region or os.environ.get("AWS_REGION", "us-east-1")

    async def publish(self, envelope: EventEnvelope) -> PublishResult:
        import aioboto3  # type: ignore[import]
        session = aioboto3.Session()
        async with session.client("events", region_name=self._region) as client:
            response = await client.put_events(
                Entries=[{
                    "EventBusName": self._event_bus_name,
                    "Source": self._source or envelope.event_id,
                    "DetailType": envelope.event_id,
                    "Detail": json.dumps(envelope.__dict__, default=str),
                    "Time": envelope.metadata.created_at,
                }]
            )
        if response.get("FailedEntryCount", 0) > 0:
            entry = response["Entries"][0]
            raise RuntimeError(f"EventBridge publish failed: {entry.get('ErrorCode')} — {entry.get('ErrorMessage')}")
        return PublishResult(message_id=response["Entries"][0].get("EventId"))
