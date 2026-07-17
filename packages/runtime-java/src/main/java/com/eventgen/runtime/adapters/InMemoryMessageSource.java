package com.eventgen.runtime.adapters;

import com.eventgen.runtime.EventEnvelope;
import com.eventgen.runtime.MessageSource;
import com.eventgen.runtime.ReceiveOptions;
import com.eventgen.runtime.ReceivedMessage;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class InMemoryMessageSource implements MessageSource {
    public final List<InMemoryReceivedRecord> messages = new ArrayList<>();
    public final List<InMemoryReceivedRecord> deadLetters = new ArrayList<>();

    public InMemoryMessageSource(List<EventEnvelope> envelopes) {
        envelopes.forEach(this::enqueue);
    }

    public void enqueue(EventEnvelope envelope) {
        messages.add(new InMemoryReceivedRecord(envelope));
    }

    @Override
    public List<ReceivedMessage> receive(ReceiveOptions options) {
        List<ReceivedMessage> received = new ArrayList<>();
        for (InMemoryReceivedRecord record : messages) {
            if (received.size() >= options.maxMessages()) break;
            if (record.acked || record.deadLettered) continue;
            record.attempts++;
            received.add(new InMemoryReceivedMessage(this, record));
        }
        return received;
    }

    public static class InMemoryReceivedRecord {
        public final EventEnvelope envelope;
        public int attempts = 0;
        public boolean acked = false;
        public boolean deadLettered = false;

        InMemoryReceivedRecord(EventEnvelope envelope) {
            this.envelope = envelope;
        }
    }

    private static class InMemoryReceivedMessage implements ReceivedMessage {
        private final InMemoryMessageSource source;
        private final InMemoryReceivedRecord record;

        InMemoryReceivedMessage(InMemoryMessageSource source, InMemoryReceivedRecord record) {
            this.source = source;
            this.record = record;
        }

        public EventEnvelope envelope() { return record.envelope; }
        public Object raw() { return record; }
        public Map<String, Object> attributes() { return Map.of(); }
        public void ack() { record.acked = true; }
        public void retry(Exception error) {}
        public void deadLetter(Exception error) {
            record.deadLettered = true;
            source.deadLetters.add(record);
        }
    }
}
