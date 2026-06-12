package com.eventgen.runtime.adapters;

import com.eventgen.runtime.EventEnvelope;
import com.eventgen.runtime.PublishResult;
import com.eventgen.runtime.TransportAdapter;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rabbitmq.client.AMQP;
import com.rabbitmq.client.Channel;
import com.rabbitmq.client.Connection;
import com.rabbitmq.client.ConnectionFactory;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;

public class RabbitMQTransportAdapter implements TransportAdapter, AutoCloseable {

    private final Connection connection;
    private final Channel channel;
    private final String exchange;
    /** If null, defaults to envelope.eventId() at publish time */
    private final String routingKey;
    private final ObjectMapper mapper = new ObjectMapper();

    public RabbitMQTransportAdapter(String url, String exchange) throws Exception {
        this(url, exchange, null);
    }

    public RabbitMQTransportAdapter(String url, String exchange, String routingKey) throws Exception {
        ConnectionFactory factory = new ConnectionFactory();
        factory.setUri(url);
        this.connection = factory.newConnection();
        this.channel = connection.createChannel();
        this.exchange = exchange;
        this.routingKey = routingKey;
    }

    /** Use this constructor to inject a pre-configured channel (e.g. for testing) */
    public RabbitMQTransportAdapter(Connection connection, Channel channel, String exchange, String routingKey) {
        this.connection = connection;
        this.channel = channel;
        this.exchange = exchange;
        this.routingKey = routingKey;
    }

    @Override
    public PublishResult publish(EventEnvelope envelope) {
        try {
            String messageId = UUID.randomUUID().toString();
            String body = mapper.writeValueAsString(envelope);

            AMQP.BasicProperties props = new AMQP.BasicProperties.Builder()
                .contentType("application/json")
                .messageId(messageId)
                .headers(Map.of(
                    "eventId", envelope.eventId(),
                    "version", envelope.version(),
                    "traceId", envelope.metadata().traceId()
                ))
                .build();

            channel.basicPublish(
                exchange,
                routingKey != null ? routingKey : envelope.eventId(),
                props,
                body.getBytes(StandardCharsets.UTF_8)
            );

            return new PublishResult(messageId);
        } catch (Exception e) {
            throw new RuntimeException("RabbitMQ publish failed for event: " + envelope.eventId(), e);
        }
    }

    @Override
    public void close() throws Exception {
        channel.close();
        connection.close();
    }
}
