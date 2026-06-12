package com.eventgen.runtime.adapters;

import com.eventgen.runtime.EventEnvelope;
import com.eventgen.runtime.PublishResult;
import com.eventgen.runtime.TransportAdapter;
import com.fasterxml.jackson.databind.ObjectMapper;
import software.amazon.awssdk.services.eventbridge.EventBridgeClient;
import software.amazon.awssdk.services.eventbridge.model.PutEventsRequest;
import software.amazon.awssdk.services.eventbridge.model.PutEventsRequestEntry;
import software.amazon.awssdk.services.eventbridge.model.PutEventsResponse;
import software.amazon.awssdk.services.eventbridge.model.PutEventsResultEntry;

import java.time.Instant;

public class EventBridgeTransportAdapter implements TransportAdapter {

    private final EventBridgeClient client;
    private final String eventBusName;
    /** If null, defaults to envelope.eventId() at publish time */
    private final String source;
    private final ObjectMapper mapper = new ObjectMapper();

    public EventBridgeTransportAdapter(String eventBusName) {
        this.eventBusName = eventBusName;
        this.source = null;
        this.client = EventBridgeClient.create();
    }

    public EventBridgeTransportAdapter(String eventBusName, String source) {
        this.eventBusName = eventBusName;
        this.source = source;
        this.client = EventBridgeClient.create();
    }

    public EventBridgeTransportAdapter(EventBridgeClient client, String eventBusName, String source) {
        this.client = client;
        this.eventBusName = eventBusName;
        this.source = source;
    }

    @Override
    public PublishResult publish(EventEnvelope envelope) {
        try {
            String detail = mapper.writeValueAsString(envelope);
            PutEventsRequestEntry entry = PutEventsRequestEntry.builder()
                .eventBusName(eventBusName)
                .source(source != null ? source : envelope.eventId())
                .detailType(envelope.eventId())
                .detail(detail)
                .time(Instant.parse(envelope.metadata().createdAt()))
                .build();

            PutEventsResponse response = client.putEvents(PutEventsRequest.builder()
                .entries(entry)
                .build());

            if (response.failedEntryCount() > 0) {
                PutEventsResultEntry failed = response.entries().get(0);
                throw new RuntimeException(
                    "EventBridge publish failed for " + envelope.eventId() +
                    ": " + failed.errorCode() + " — " + failed.errorMessage()
                );
            }

            return new PublishResult(response.entries().get(0).eventId());
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("EventBridge publish failed for event: " + envelope.eventId(), e);
        }
    }
}
