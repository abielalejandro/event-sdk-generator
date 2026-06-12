package com.eventgen.runtime.adapters;

import com.eventgen.runtime.EventEnvelope;
import com.eventgen.runtime.PublishResult;
import com.eventgen.runtime.TransportAdapter;
import com.fasterxml.jackson.databind.ObjectMapper;
import software.amazon.awssdk.services.sqs.SqsClient;
import software.amazon.awssdk.services.sqs.model.MessageAttributeValue;
import software.amazon.awssdk.services.sqs.model.SendMessageRequest;
import software.amazon.awssdk.services.sqs.model.SendMessageResponse;

import java.util.Map;

public class SqsTransportAdapter implements TransportAdapter {

    private final SqsClient client;
    private final String queueUrl;
    private final ObjectMapper mapper = new ObjectMapper();

    public SqsTransportAdapter(String queueUrl) {
        this.queueUrl = queueUrl;
        this.client = SqsClient.create();
    }

    public SqsTransportAdapter(SqsClient client, String queueUrl) {
        this.client = client;
        this.queueUrl = queueUrl;
    }

    @Override
    public PublishResult publish(EventEnvelope envelope) {
        try {
            String body = mapper.writeValueAsString(envelope);
            SendMessageResponse response = client.sendMessage(SendMessageRequest.builder()
                .queueUrl(queueUrl)
                .messageBody(body)
                .messageAttributes(Map.of(
                    "eventId", attr(envelope.eventId()),
                    "version", attr(envelope.version())
                ))
                .build());
            return new PublishResult(response.messageId());
        } catch (Exception e) {
            throw new RuntimeException("SQS publish failed for event: " + envelope.eventId(), e);
        }
    }

    private static MessageAttributeValue attr(String value) {
        return MessageAttributeValue.builder().dataType("String").stringValue(value).build();
    }
}
