package com.eventgen.runtime;

public interface TransportAdapter {
    PublishResult publish(EventEnvelope envelope);
}
