package com.eventgen.runtime.adapters;

import com.eventgen.runtime.EventEnvelope;
import com.eventgen.runtime.PublishResult;
import com.eventgen.runtime.TransportAdapter;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.cloud.pubsub.v1.Publisher;
import com.google.protobuf.ByteString;
import com.google.pubsub.v1.PubsubMessage;
import com.google.pubsub.v1.TopicName;

import java.util.concurrent.TimeUnit;

public class PubSubTransportAdapter implements TransportAdapter, AutoCloseable {

    private final Publisher publisher;
    private final ObjectMapper mapper = new ObjectMapper();

    public PubSubTransportAdapter(String projectId, String topicId) throws Exception {
        this.publisher = Publisher.newBuilder(TopicName.of(projectId, topicId)).build();
    }

    /** Use this constructor to inject a pre-configured Publisher (e.g. for testing) */
    public PubSubTransportAdapter(Publisher publisher) {
        this.publisher = publisher;
    }

    @Override
    public PublishResult publish(EventEnvelope envelope) {
        try {
            String json = mapper.writeValueAsString(envelope);
            PubsubMessage message = PubsubMessage.newBuilder()
                .setData(ByteString.copyFromUtf8(json))
                .putAttributes("eventId", envelope.eventId())
                .putAttributes("version", envelope.version())
                .putAttributes("traceId", envelope.metadata().traceId())
                .build();
            String messageId = publisher.publish(message).get();
            return new PublishResult(messageId);
        } catch (Exception e) {
            throw new RuntimeException("Pub/Sub publish failed for event: " + envelope.eventId(), e);
        }
    }

    @Override
    public void close() throws Exception {
        publisher.shutdown();
        publisher.awaitTermination(30, TimeUnit.SECONDS);
    }
}
