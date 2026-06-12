package com.eventgen.runtime.adapters;

import com.eventgen.runtime.EventEnvelope;
import com.eventgen.runtime.PublishResult;
import com.eventgen.runtime.TransportAdapter;
import com.fasterxml.jackson.databind.ObjectMapper;
import software.amazon.awssdk.services.sns.SnsClient;
import software.amazon.awssdk.services.sns.model.MessageAttributeValue;
import software.amazon.awssdk.services.sns.model.PublishRequest;
import software.amazon.awssdk.services.sns.model.PublishResponse;

import java.util.Map;

public class SnsTransportAdapter implements TransportAdapter {

    private final SnsClient client;
    private final String topicArn;
    private final ObjectMapper mapper = new ObjectMapper();

    public SnsTransportAdapter(String topicArn) {
        this.topicArn = topicArn;
        this.client = SnsClient.create();
    }

    public SnsTransportAdapter(SnsClient client, String topicArn) {
        this.client = client;
        this.topicArn = topicArn;
    }

    @Override
    public PublishResult publish(EventEnvelope envelope) {
        try {
            String body = mapper.writeValueAsString(envelope);
            var builder = PublishRequest.builder()
                .topicArn(topicArn)
                .message(body)
                .messageAttributes(Map.of(
                    "eventId", attr(envelope.eventId()),
                    "version", attr(envelope.version())
                ));
            if (envelope.metadata().fifo() != null) {
                builder.messageGroupId(envelope.metadata().fifo().messageGroupId());
                if (envelope.metadata().fifo().deduplicationId() != null)
                    builder.messageDeduplicationId(envelope.metadata().fifo().deduplicationId());
            }
            PublishResponse response = client.publish(builder.build());
            return new PublishResult(response.messageId());
        } catch (Exception e) {
            throw new RuntimeException("SNS publish failed for event: " + envelope.eventId(), e);
        }
    }

    private static MessageAttributeValue attr(String value) {
        return MessageAttributeValue.builder().dataType("String").stringValue(value).build();
    }
}
