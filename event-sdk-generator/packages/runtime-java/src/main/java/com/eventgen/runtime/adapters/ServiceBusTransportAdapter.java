package com.eventgen.runtime.adapters;

import com.azure.messaging.servicebus.ServiceBusClientBuilder;
import com.azure.messaging.servicebus.ServiceBusMessage;
import com.azure.messaging.servicebus.ServiceBusSenderClient;
import com.eventgen.runtime.EventEnvelope;
import com.eventgen.runtime.PublishResult;
import com.eventgen.runtime.TransportAdapter;
import com.fasterxml.jackson.databind.ObjectMapper;

public class ServiceBusTransportAdapter implements TransportAdapter, AutoCloseable {

    private final ServiceBusSenderClient sender;
    private final ObjectMapper mapper = new ObjectMapper();

    /**
     * @param connectionString Azure Service Bus connection string
     * @param queueOrTopicName Queue or topic name to send to
     */
    public ServiceBusTransportAdapter(String connectionString, String queueOrTopicName) {
        this.sender = new ServiceBusClientBuilder()
            .connectionString(connectionString)
            .sender()
            .queueName(queueOrTopicName)
            .buildClient();
    }

    /** Use this constructor to inject a pre-configured sender (e.g. for testing) */
    public ServiceBusTransportAdapter(ServiceBusSenderClient sender) {
        this.sender = sender;
    }

    @Override
    public PublishResult publish(EventEnvelope envelope) {
        try {
            String body = mapper.writeValueAsString(envelope);
            ServiceBusMessage message = new ServiceBusMessage(body)
                .setContentType("application/json");
            message.getApplicationProperties().put("eventId", envelope.eventId());
            message.getApplicationProperties().put("version", envelope.version());
            message.getApplicationProperties().put("traceId", envelope.metadata().traceId());
            sender.sendMessage(message);
            return new PublishResult(message.getMessageId());
        } catch (Exception e) {
            throw new RuntimeException("Service Bus publish failed for event: " + envelope.eventId(), e);
        }
    }

    @Override
    public void close() {
        sender.close();
    }
}
