package com.eventgen.runtime;

import com.eventgen.runtime.adapters.InMemoryMessageSource;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ConsumerRunnerTest {
    @Test
    void acksMessagesHandledByConsumer() throws Exception {
        InMemoryMessageSource source = new InMemoryMessageSource(List.of(envelope()));
        AtomicBoolean handled = new AtomicBoolean(false);

        ConsumerRunner runner = ConsumerRunner.builder()
                .source(source)
                .consumer(message -> {
                    handled.set(true);
                    return true;
                })
                .idleDelayMillis(1)
                .build();

        runner.start();
        waitUntil(() -> source.messages.get(0).acked);
        runner.stop();

        assertTrue(handled.get());
        assertTrue(source.messages.get(0).acked);
    }

    @Test
    void appliesUnhandledPolicyWhenConsumerDoesNotHandleMessage() throws Exception {
        InMemoryMessageSource source = new InMemoryMessageSource(List.of(envelope()));
        ConsumerRunner runner = ConsumerRunner.builder()
                .source(source)
                .consumer(message -> false)
                .unhandled(MessageAction.ACK)
                .idleDelayMillis(1)
                .build();

        runner.start();
        waitUntil(() -> source.messages.get(0).acked);
        runner.stop();

        assertTrue(source.messages.get(0).acked);
    }

    @Test
    void retriesMessagesWhenHandlerFails() throws Exception {
        InMemoryMessageSource source = new InMemoryMessageSource(List.of(envelope()));
        ConsumerRunner runner = ConsumerRunner.builder()
                .source(source)
                .consumer(message -> {
                    throw new IllegalStateException("boom");
                })
                .handlerError(MessageAction.RETRY)
                .idleDelayMillis(1)
                .build();

        runner.start();
        waitUntil(() -> source.messages.get(0).attempts > 1);
        runner.stop();

        assertTrue(source.messages.get(0).attempts > 1);
    }

    @Test
    void deadLettersMessagesWhenHandlerFailsAndPolicyRequiresIt() throws Exception {
        InMemoryMessageSource source = new InMemoryMessageSource(List.of(envelope()));
        ConsumerRunner runner = ConsumerRunner.builder()
                .source(source)
                .consumer(message -> {
                    throw new IllegalStateException("boom");
                })
                .handlerError(MessageAction.DEAD_LETTER)
                .idleDelayMillis(1)
                .build();

        runner.start();
        waitUntil(() -> source.deadLetters.size() == 1);
        runner.stop();

        assertTrue(source.messages.get(0).deadLettered);
    }

    @Test
    void processesMessagesUpToConfiguredConcurrency() throws Exception {
        InMemoryMessageSource source = new InMemoryMessageSource(List.of(envelope("trace-1"), envelope("trace-2")));
        AtomicInteger calls = new AtomicInteger(0);
        ConsumerRunner runner = ConsumerRunner.builder()
                .source(source)
                .consumer(message -> {
                    calls.incrementAndGet();
                    return true;
                })
                .concurrency(2)
                .idleDelayMillis(1)
                .build();

        runner.start();
        waitUntil(() -> source.messages.stream().allMatch(message -> message.acked));
        runner.stop();

        assertEquals(2, calls.get());
        assertEquals(List.of(1, 1), source.messages.stream().map(message -> message.attempts).toList());
    }

    @Test
    void closesSourceWhenStopped() throws Exception {
        CloseTrackingMessageSource source = new CloseTrackingMessageSource(List.of());
        ConsumerRunner runner = ConsumerRunner.builder()
                .source(source)
                .consumer(message -> true)
                .idleDelayMillis(1)
                .build();

        runner.start();
        runner.stop();

        assertTrue(source.closed.get());
    }

    private static EventEnvelope envelope() {
        return envelope("trace-1");
    }

    private static EventEnvelope envelope(String traceId) {
        return new EventEnvelope(
                "payments.payment-created",
                "1.0.0",
                "{}",
                new EventMetadata("2026-07-17T00:00:00.000Z", traceId)
        );
    }

    private static void waitUntil(Check check) throws Exception {
        long deadline = System.currentTimeMillis() + 1000;
        while (System.currentTimeMillis() < deadline) {
            if (check.ok()) return;
            Thread.sleep(10);
        }
        throw new AssertionError("condition was not met before timeout");
    }

    private interface Check {
        boolean ok();
    }

    private static class CloseTrackingMessageSource extends InMemoryMessageSource {
        final AtomicBoolean closed = new AtomicBoolean(false);

        CloseTrackingMessageSource(List<EventEnvelope> envelopes) {
            super(envelopes);
        }

        @Override
        public void close() {
            closed.set(true);
        }
    }
}
