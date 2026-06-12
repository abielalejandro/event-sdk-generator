package com.eventgen.runtime.adapters;

import com.eventgen.runtime.EventEnvelope;
import com.eventgen.runtime.PublishResult;
import com.eventgen.runtime.TransportAdapter;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.clients.producer.RecordMetadata;

import java.nio.charset.StandardCharsets;
import java.util.Properties;

public class KafkaTransportAdapter implements TransportAdapter, AutoCloseable {

    private final KafkaProducer<String, String> producer;
    private final String topic;
    private final ObjectMapper mapper = new ObjectMapper();

    /**
     * @param topic          Kafka topic to publish to
     * @param producerConfig Standard Kafka producer properties
     *                       (bootstrap.servers, key.serializer, value.serializer, etc.)
     */
    public KafkaTransportAdapter(String topic, Properties producerConfig) {
        this.topic = topic;
        Properties config = new Properties();
        config.putAll(producerConfig);
        config.putIfAbsent("key.serializer", "org.apache.kafka.common.serialization.StringSerializer");
        config.putIfAbsent("value.serializer", "org.apache.kafka.common.serialization.StringSerializer");
        this.producer = new KafkaProducer<>(config);
    }

    @Override
    public PublishResult publish(EventEnvelope envelope) {
        try {
            String value = mapper.writeValueAsString(envelope);
            ProducerRecord<String, String> record = new ProducerRecord<>(topic, envelope.eventId(), value);
            record.headers()
                .add("eventId", envelope.eventId().getBytes(StandardCharsets.UTF_8))
                .add("version", envelope.version().getBytes(StandardCharsets.UTF_8))
                .add("traceId", envelope.metadata().traceId().getBytes(StandardCharsets.UTF_8));

            RecordMetadata meta = producer.send(record).get();
            return new PublishResult(meta.partition() + "-" + meta.offset());
        } catch (Exception e) {
            throw new RuntimeException("Kafka publish failed for event: " + envelope.eventId(), e);
        }
    }

    @Override
    public void close() {
        producer.close();
    }
}
