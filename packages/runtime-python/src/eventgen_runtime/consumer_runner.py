from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any

from eventgen_runtime.types import ErrorHook, EventConsumer, MessageAction, MessageSource, ReceiveOptions, ReceivedMessage


@dataclass
class ConsumerRunnerOptions:
    source: MessageSource
    consumer: EventConsumer
    concurrency: int = 1
    idle_delay_seconds: float = 1.0
    unhandled: MessageAction = "ack"
    handler_error: MessageAction = "retry"
    on_error: ErrorHook | None = None


class ConsumerRunner:
    def __init__(self, options: ConsumerRunnerOptions) -> None:
        self._source = options.source
        self._consumer = options.consumer
        self._concurrency = max(1, options.concurrency)
        self._idle_delay_seconds = max(0.0, options.idle_delay_seconds)
        self._unhandled = options.unhandled
        self._handler_error = options.handler_error
        self._on_error = options.on_error
        self._running = False
        self._task: asyncio.Task[None] | None = None

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop())

    async def stop(self) -> None:
        self._running = False
        close = getattr(self._source, "close", None)
        if close:
            await close()
        if self._task:
            await self._task

    async def wait(self) -> None:
        if self._task:
            await self._task

    async def _loop(self) -> None:
        while self._running:
            try:
                messages = await self._source.receive(ReceiveOptions(max_messages=self._concurrency))
            except Exception as error:
                await self._report(error, None)
                await asyncio.sleep(self._idle_delay_seconds)
                continue

            if not messages:
                await asyncio.sleep(self._idle_delay_seconds)
                continue

            await asyncio.gather(*(self._process(message) for message in messages[: self._concurrency]))

    async def _process(self, message: ReceivedMessage) -> None:
        try:
            handled = await self._consumer.handle(message.envelope)
            if handled:
                await message.ack()
                return
            await self._apply_action(self._unhandled, message)
        except Exception as error:
            await self._report(error, message)
            await self._apply_action(self._handler_error, message, error)

    async def _apply_action(self, action: MessageAction, message: ReceivedMessage, error: Any | None = None) -> None:
        if action == "ack":
            await message.ack()
        elif action == "retry":
            await message.retry(error)
        elif action == "dead_letter":
            await message.dead_letter(error)

    async def _report(self, error: Any, message: ReceivedMessage | None) -> None:
        if not self._on_error:
            return
        result = self._on_error(error, message)
        if hasattr(result, "__await__"):
            await result


def run_consumer(
    *,
    source: MessageSource,
    consumer: EventConsumer,
    concurrency: int = 1,
    idle_delay_seconds: float = 1.0,
    unhandled: MessageAction = "ack",
    handler_error: MessageAction = "retry",
    on_error: ErrorHook | None = None,
) -> ConsumerRunner:
    return ConsumerRunner(
        ConsumerRunnerOptions(
            source=source,
            consumer=consumer,
            concurrency=concurrency,
            idle_delay_seconds=idle_delay_seconds,
            unhandled=unhandled,
            handler_error=handler_error,
            on_error=on_error,
        )
    )
