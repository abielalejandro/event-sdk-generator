from __future__ import annotations

import json
import os
from typing import Any

from eventgen_runtime.types import EventEnvelope, EventMetadata, ReceiveOptions


class _SqsReceivedMessage:
    def __init__(self, source: "SqsMessageSource", message: dict[str, Any], envelope: EventEnvelope) -> None:
        self.envelope = envelope
        self.raw = message
        self.attributes = {
            "message_id": message.get("MessageId"),
            "attributes": message.get("Attributes"),
            "message_attributes": message.get("MessageAttributes"),
        }
        self._source = source
        self._receipt_handle = message.get("ReceiptHandle")

    async def ack(self) -> None:
        if not self._receipt_handle:
            return
        async with self._source.session.client("sqs", region_name=self._source.region) as client:
            await client.delete_message(QueueUrl=self._source.queue_url, ReceiptHandle=self._receipt_handle)

    async def retry(self, error: Any | None = None) -> None:
        if not self._receipt_handle:
            return
        async with self._source.session.client("sqs", region_name=self._source.region) as client:
            await client.change_message_visibility(
                QueueUrl=self._source.queue_url,
                ReceiptHandle=self._receipt_handle,
                VisibilityTimeout=0,
            )

    async def dead_letter(self, error: Any | None = None) -> None:
        await self.retry(error)


class SqsMessageSource:
    def __init__(
        self,
        queue_url: str,
        region: str | None = None,
        wait_time_seconds: int = 20,
        visibility_timeout_seconds: int | None = None,
    ) -> None:
        import aioboto3  # type: ignore[import]

        self.queue_url = queue_url
        self.region = region or os.environ.get("AWS_REGION", "us-east-1")
        self.wait_time_seconds = wait_time_seconds
        self.visibility_timeout_seconds = visibility_timeout_seconds
        self.session = aioboto3.Session()

    async def receive(self, options: ReceiveOptions | None = None) -> list[_SqsReceivedMessage]:
        max_messages = min(10, max(1, options.max_messages if options and options.max_messages else 1))
        extra = {}
        if self.visibility_timeout_seconds is not None:
            extra["VisibilityTimeout"] = self.visibility_timeout_seconds

        async with self.session.client("sqs", region_name=self.region) as client:
            response = await client.receive_message(
                QueueUrl=self.queue_url,
                MaxNumberOfMessages=max_messages,
                WaitTimeSeconds=self.wait_time_seconds,
                MessageAttributeNames=["All"],
                AttributeNames=["All"],
                **extra,
            )

        return [
            _SqsReceivedMessage(self, message, _parse_envelope(message.get("Body")))
            for message in response.get("Messages", [])
        ]

    async def close(self) -> None:
        return None


def _parse_envelope(body: str | None) -> EventEnvelope:
    if not body:
        raise ValueError("SQS message body is empty")
    data = json.loads(body)
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
