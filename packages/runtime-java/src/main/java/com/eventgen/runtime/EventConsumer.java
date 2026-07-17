package com.eventgen.runtime;

public interface EventConsumer {
    boolean handle(EventEnvelope envelope) throws Exception;
}
