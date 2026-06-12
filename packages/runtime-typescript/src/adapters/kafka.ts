import { Kafka, type Producer } from "kafkajs";
import type { TransportAdapter, EventEnvelope, PublishResult } from "../types.js";

export type KafkaTransportAdapterOptions = {
  topic: string;
  brokers: string[];
  clientId?: string;
  /** Pass an existing Kafka instance to share connections */
  kafka?: Kafka;
};

export class KafkaTransportAdapter implements TransportAdapter {
  private readonly producer: Producer;
  private readonly topic: string;
  private connected = false;

  constructor(options: KafkaTransportAdapterOptions) {
    this.topic = options.topic;
    const kafka = options.kafka ?? new Kafka({
      clientId: options.clientId ?? "eventgen",
      brokers: options.brokers,
    });
    this.producer = kafka.producer();
  }

  async publish(envelope: EventEnvelope): Promise<PublishResult> {
    if (!this.connected) {
      await this.producer.connect();
      this.connected = true;
    }

    const result = await this.producer.send({
      topic: this.topic,
      messages: [
        {
          key: envelope.eventId,
          value: JSON.stringify(envelope),
          headers: {
            eventId: envelope.eventId,
            version: envelope.version,
            traceId: envelope.metadata.traceId,
          },
        },
      ],
    });

    const record = result[0];
    return { messageId: `${record.partition}-${record.baseOffset}` };
  }

  async disconnect(): Promise<void> {
    await this.producer.disconnect();
    this.connected = false;
  }
}
