package com.eventgen.runtime;

public record EventEnvelope(String eventId, String version, Object payload, EventMetadata metadata) {}
