package com.eventgen.runtime.adapters;

import com.eventgen.runtime.EventEnvelope;
import com.eventgen.runtime.PublishResult;
import com.eventgen.runtime.TransportAdapter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

public class InMemoryTransportAdapter implements TransportAdapter {

    public record RecordedEvent(EventEnvelope envelope, Instant publishedAt) {}

    private final List<RecordedEvent> published = new ArrayList<>();

    @Override
    public PublishResult publish(EventEnvelope envelope) {
        published.add(new RecordedEvent(envelope, Instant.now()));
        return new PublishResult(UUID.randomUUID().toString());
    }

    public List<RecordedEvent> getPublished() {
        return Collections.unmodifiableList(published);
    }

    public void clear() {
        published.clear();
    }
}
