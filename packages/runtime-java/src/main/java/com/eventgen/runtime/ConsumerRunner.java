package com.eventgen.runtime;

import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.BiConsumer;

public class ConsumerRunner implements AutoCloseable {
    private final MessageSource source;
    private final EventConsumer consumer;
    private final int concurrency;
    private final long idleDelayMillis;
    private final MessageAction unhandled;
    private final MessageAction handlerError;
    private final BiConsumer<Exception, ReceivedMessage> onError;
    private volatile boolean running = false;
    private ExecutorService executor;

    private ConsumerRunner(Builder builder) {
        this.source = builder.source;
        this.consumer = builder.consumer;
        this.concurrency = Math.max(1, builder.concurrency);
        this.idleDelayMillis = Math.max(0, builder.idleDelayMillis);
        this.unhandled = builder.unhandled;
        this.handlerError = builder.handlerError;
        this.onError = builder.onError;
    }

    public static Builder builder() { return new Builder(); }

    public void start() {
        if (running) return;
        running = true;
        executor = Executors.newFixedThreadPool(concurrency);
        Thread loop = new Thread(this::loop, "eventgen-consumer-runner");
        loop.setDaemon(true);
        loop.start();
    }

    public void stop() throws Exception {
        running = false;
        if (executor != null) executor.shutdown();
        source.close();
    }

    private void loop() {
        while (running) {
            try {
                List<ReceivedMessage> messages = source.receive(new ReceiveOptions(concurrency));
                if (messages.isEmpty()) {
                    sleep();
                    continue;
                }
                for (ReceivedMessage message : messages) {
                    executor.submit(() -> process(message));
                }
            } catch (Exception error) {
                report(error, null);
                sleep();
            }
        }
    }

    private void process(ReceivedMessage message) {
        try {
            boolean handled = consumer.handle(message.envelope());
            if (handled) {
                message.ack();
            } else {
                applyAction(unhandled, message, null);
            }
        } catch (Exception error) {
            report(error, message);
            try {
                applyAction(handlerError, message, error);
            } catch (Exception actionError) {
                report(actionError, message);
            }
        }
    }

    private void applyAction(MessageAction action, ReceivedMessage message, Exception error) throws Exception {
        switch (action) {
            case ACK -> message.ack();
            case RETRY -> message.retry(error);
            case DEAD_LETTER -> message.deadLetter(error);
            case IGNORE -> {}
        }
    }

    private void report(Exception error, ReceivedMessage message) {
        if (onError != null) onError.accept(error, message);
    }

    private void sleep() {
        try {
            Thread.sleep(idleDelayMillis);
        } catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
        }
    }

    @Override
    public void close() throws Exception {
        stop();
    }

    public static class Builder {
        private MessageSource source;
        private EventConsumer consumer;
        private int concurrency = 1;
        private long idleDelayMillis = 1000;
        private MessageAction unhandled = MessageAction.ACK;
        private MessageAction handlerError = MessageAction.RETRY;
        private BiConsumer<Exception, ReceivedMessage> onError;

        public Builder source(MessageSource source) { this.source = source; return this; }
        public Builder consumer(EventConsumer consumer) { this.consumer = consumer; return this; }
        public Builder concurrency(int concurrency) { this.concurrency = concurrency; return this; }
        public Builder idleDelayMillis(long idleDelayMillis) { this.idleDelayMillis = idleDelayMillis; return this; }
        public Builder unhandled(MessageAction unhandled) { this.unhandled = unhandled; return this; }
        public Builder handlerError(MessageAction handlerError) { this.handlerError = handlerError; return this; }
        public Builder onError(BiConsumer<Exception, ReceivedMessage> onError) { this.onError = onError; return this; }

        public ConsumerRunner build() {
            if (source == null) throw new IllegalStateException("source is required");
            if (consumer == null) throw new IllegalStateException("consumer is required");
            return new ConsumerRunner(this);
        }
    }
}
