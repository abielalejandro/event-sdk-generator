package com.eventgen.runtime;

public record EventMetadata(String createdAt, String traceId, FifoOptions fifo) {
    /** Constructor without FIFO (standard queues/topics). */
    public EventMetadata(String createdAt, String traceId) {
        this(createdAt, traceId, null);
    }
}
