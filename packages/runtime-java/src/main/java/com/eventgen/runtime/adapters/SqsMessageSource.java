package com.eventgen.runtime.adapters;

import com.eventgen.runtime.EventEnvelope;
import com.eventgen.runtime.MessageSource;
import com.eventgen.runtime.ReceiveOptions;
import com.eventgen.runtime.ReceivedMessage;
import com.fasterxml.jackson.databind.ObjectMapper;
import software.amazon.awssdk.services.sqs.SqsClient;
import software.amazon.awssdk.services.sqs.model.ChangeMessageVisibilityRequest;
import software.amazon.awssdk.services.sqs.model.DeleteMessageRequest;
import software.amazon.awssdk.services.sqs.model.Message;
import software.amazon.awssdk.services.sqs.model.ReceiveMessageRequest;

import java.util.List;
import java.util.Map;

public class SqsMessageSource implements MessageSource {
    private final SqsClient client;
    private final String queueUrl;
    private final int waitTimeSeconds;
    private final ObjectMapper mapper = new ObjectMapper();

    public SqsMessageSource(String queueUrl) {
        this(SqsClient.create(), queueUrl, 20);
    }

    public SqsMessageSource(SqsClient client, String queueUrl, int waitTimeSeconds) {
        this.client = client;
        this.queueUrl = queueUrl;
        this.waitTimeSeconds = waitTimeSeconds;
    }

    @Override
    public List<ReceivedMessage> receive(ReceiveOptions options) {
        var response = client.receiveMessage(ReceiveMessageRequest.builder()
            .queueUrl(queueUrl)
            .maxNumberOfMessages(Math.min(10, options.maxMessages()))
            .waitTimeSeconds(waitTimeSeconds)
            .messageAttributeNames("All")
            .attributeNamesWithStrings("All")
            .build());

        return response.messages().stream().map(this::toReceivedMessage).toList();
    }

    private ReceivedMessage toReceivedMessage(Message message) {
        try {
            EventEnvelope envelope = mapper.readValue(message.body(), EventEnvelope.class);
            return new SqsReceivedMessage(message, envelope);
        } catch (Exception error) {
            throw new RuntimeException("SQS message body is not an EventEnvelope", error);
        }
    }

    private class SqsReceivedMessage implements ReceivedMessage {
        private final Message message;
        private final EventEnvelope envelope;

        SqsReceivedMessage(Message message, EventEnvelope envelope) {
            this.message = message;
            this.envelope = envelope;
        }

        public EventEnvelope envelope() { return envelope; }
        public Object raw() { return message; }
        public Map<String, Object> attributes() {
            return Map.of(
                "messageId", message.messageId(),
                "attributes", message.attributesAsStrings(),
                "messageAttributes", message.messageAttributes()
            );
        }
        public void ack() {
            client.deleteMessage(DeleteMessageRequest.builder()
                .queueUrl(queueUrl)
                .receiptHandle(message.receiptHandle())
                .build());
        }
        public void retry(Exception error) {
            client.changeMessageVisibility(ChangeMessageVisibilityRequest.builder()
                .queueUrl(queueUrl)
                .receiptHandle(message.receiptHandle())
                .visibilityTimeout(0)
                .build());
        }
        public void deadLetter(Exception error) {
            retry(error);
        }
    }
}
