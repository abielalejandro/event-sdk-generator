package com.eventgen.runtime.adapters;

import com.eventgen.runtime.EventEnvelope;
import com.eventgen.runtime.MessageSource;
import com.eventgen.runtime.ReceiveOptions;
import com.eventgen.runtime.ReceivedMessage;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.clients.consumer.OffsetAndMetadata;
import org.apache.kafka.common.TopicPartition;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Properties;

public class KafkaMessageSource implements MessageSource {
    private final KafkaConsumer<String, String> consumer;
    private final ObjectMapper mapper = new ObjectMapper();

    public KafkaMessageSource(String topic, Properties consumerConfig) {
        Properties config = new Properties();
        config.putAll(consumerConfig);
        config.putIfAbsent("key.deserializer", "org.apache.kafka.common.serialization.StringDeserializer");
        config.putIfAbsent("value.deserializer", "org.apache.kafka.common.serialization.StringDeserializer");
        config.putIfAbsent("enable.auto.commit", "false");
        this.consumer = new KafkaConsumer<>(config);
        this.consumer.subscribe(List.of(topic));
    }

    @Override
    public List<ReceivedMessage> receive(ReceiveOptions options) {
        var records = consumer.poll(Duration.ofSeconds(1));
        List<ReceivedMessage> messages = new ArrayList<>();
        for (ConsumerRecord<String, String> record : records) {
            if (messages.size() >= options.maxMessages()) break;
            try {
                EventEnvelope envelope = mapper.readValue(record.value(), EventEnvelope.class);
                messages.add(new KafkaReceivedMessage(record, envelope));
            } catch (Exception error) {
                throw new RuntimeException("Kafka message value is not an EventEnvelope", error);
            }
        }
        return messages;
    }

    @Override
    public void close() {
        consumer.close();
    }

    private class KafkaReceivedMessage implements ReceivedMessage {
        private final ConsumerRecord<String, String> record;
        private final EventEnvelope envelope;

        KafkaReceivedMessage(ConsumerRecord<String, String> record, EventEnvelope envelope) {
            this.record = record;
            this.envelope = envelope;
        }

        public EventEnvelope envelope() { return envelope; }
        public Object raw() { return record; }
        public Map<String, Object> attributes() {
            return Map.of(
                "topic", record.topic(),
                "partition", record.partition(),
                "offset", record.offset(),
                "headers", record.headers().toArray()
            );
        }
        public void ack() {
            consumer.commitSync(Map.of(
                new TopicPartition(record.topic(), record.partition()),
                new OffsetAndMetadata(record.offset() + 1)
            ));
        }
        public void retry(Exception error) {}
        public void deadLetter(Exception error) {
            retry(error);
        }
    }
}
