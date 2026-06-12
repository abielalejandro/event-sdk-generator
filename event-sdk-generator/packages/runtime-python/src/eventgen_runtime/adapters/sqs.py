from __future__ import annotations
import json
import os
from eventgen_runtime.types import EventEnvelope, PublishResult


class SqsTransportAdapter:
    def __init__(self, queue_url: str, region: str | None = None) -> None:
        self._queue_url = queue_url
        self._region = region or os.environ.get("AWS_REGION", "us-east-1")

    async def publish(self, envelope: EventEnvelope) -> PublishResult:
        import aioboto3  # type: ignore[import]
        session = aioboto3.Session()
        async with session.client("sqs", region_name=self._region) as client:
            response = await client.send_message(
                QueueUrl=self._queue_url,
                MessageBody=json.dumps(envelope.__dict__, default=str),
                MessageAttributes={
                    "eventId": {"DataType": "String", "StringValue": envelope.event_id},
                    "version": {"DataType": "String", "StringValue": envelope.version},
                },
            )
        return PublishResult(message_id=response["MessageId"])
