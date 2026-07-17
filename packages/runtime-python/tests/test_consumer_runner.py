import asyncio
import unittest

from eventgen_runtime import ConsumerRunner, ConsumerRunnerOptions, EventEnvelope, EventMetadata, InMemoryMessageSource


class Consumer:
    def __init__(self, handled=True, error=None):
        self.handled = handled
        self.error = error
        self.calls = 0

    async def handle(self, envelope):
        self.calls += 1
        if self.error:
            raise self.error
        return self.handled


class ConsumerRunnerTest(unittest.IsolatedAsyncioTestCase):
    async def test_acks_messages_handled_by_consumer(self):
        source = InMemoryMessageSource([envelope()])
        consumer = Consumer(handled=True)
        runner = ConsumerRunner(ConsumerRunnerOptions(source=source, consumer=consumer, idle_delay_seconds=0.001))

        await runner.start()
        await wait_until(lambda: source.messages[0].acked)
        await runner.stop()

        self.assertEqual(1, consumer.calls)
        self.assertTrue(source.messages[0].acked)

    async def test_applies_unhandled_policy_when_consumer_does_not_handle_message(self):
        source = InMemoryMessageSource([envelope()])
        runner = ConsumerRunner(
            ConsumerRunnerOptions(source=source, consumer=Consumer(handled=False), idle_delay_seconds=0.001)
        )

        await runner.start()
        await wait_until(lambda: source.messages[0].acked)
        await runner.stop()

        self.assertTrue(source.messages[0].acked)

    async def test_retries_messages_when_handler_fails(self):
        source = InMemoryMessageSource([envelope()])
        runner = ConsumerRunner(
            ConsumerRunnerOptions(
                source=source,
                consumer=Consumer(error=RuntimeError("boom")),
                handler_error="retry",
                idle_delay_seconds=0.001,
            )
        )

        await runner.start()
        await wait_until(lambda: source.messages[0].attempts > 1)
        await runner.stop()

        self.assertGreater(source.messages[0].attempts, 1)

    async def test_dead_letters_messages_when_handler_fails_and_policy_requires_it(self):
        source = InMemoryMessageSource([envelope()])
        runner = ConsumerRunner(
            ConsumerRunnerOptions(
                source=source,
                consumer=Consumer(error=RuntimeError("boom")),
                handler_error="dead_letter",
                idle_delay_seconds=0.001,
            )
        )

        await runner.start()
        await wait_until(lambda: len(source.dead_letters) == 1)
        await runner.stop()

        self.assertTrue(source.messages[0].dead_lettered)

    async def test_processes_messages_up_to_configured_concurrency(self):
        source = InMemoryMessageSource([envelope("trace-1"), envelope("trace-2")])
        consumer = Consumer(handled=True)
        runner = ConsumerRunner(
            ConsumerRunnerOptions(source=source, consumer=consumer, concurrency=2, idle_delay_seconds=0.001)
        )

        await runner.start()
        await wait_until(lambda: all(message.acked for message in source.messages))
        await runner.stop()

        self.assertEqual(2, consumer.calls)
        self.assertEqual([1, 1], [message.attempts for message in source.messages])

    async def test_closes_source_when_stopped(self):
        source = CloseTrackingMessageSource([])
        runner = ConsumerRunner(ConsumerRunnerOptions(source=source, consumer=Consumer(), idle_delay_seconds=0.001))

        await runner.start()
        await runner.stop()

        self.assertTrue(source.closed)


class CloseTrackingMessageSource(InMemoryMessageSource):
    def __init__(self, envelopes):
        super().__init__(envelopes)
        self.closed = False

    async def close(self):
        self.closed = True


def envelope(trace_id="trace-1"):
    return EventEnvelope(
        event_id="payments.payment_created",
        version="1.0.0",
        payload={},
        metadata=EventMetadata(created_at="2026-07-17T00:00:00.000Z", trace_id=trace_id),
    )


async def wait_until(check):
    deadline = asyncio.get_running_loop().time() + 1
    while asyncio.get_running_loop().time() < deadline:
        if check():
            return
        await asyncio.sleep(0.01)
    raise AssertionError("condition was not met before timeout")
