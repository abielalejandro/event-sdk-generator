import { Kafka, type Consumer, type EachMessagePayload, type KafkaMessage } from "kafkajs";
import type { EventEnvelope, MessageSource, ReceiveOptions, ReceivedMessage } from "../types.js";

export type KafkaMessageSourceOptions = {
  topic: string;
  groupId: string;
  brokers: string[];
  clientId?: string;
  kafka?: Kafka;
  fromBeginning?: boolean;
};

type QueuedKafkaMessage = {
  payload: EachMessagePayload;
};

export class KafkaMessageSource implements MessageSource {
  private readonly consumer: Consumer;
  private readonly topic: string;
  private readonly fromBeginning: boolean;
  private readonly queue: QueuedKafkaMessage[] = [];
  private connected = false;
  private closed = false;
  private waiters: Array<() => void> = [];

  constructor(options: KafkaMessageSourceOptions) {
    this.topic = options.topic;
    this.fromBeginning = options.fromBeginning ?? false;
    const kafka = options.kafka ?? new Kafka({
      clientId: options.clientId ?? "eventgen",
      brokers: options.brokers,
    });
    this.consumer = kafka.consumer({ groupId: options.groupId });
  }

  async receive(options?: ReceiveOptions): Promise<ReceivedMessage[]> {
    await this.ensureStarted();
    const maxMessages = Math.max(1, options?.maxMessages ?? 1);

    if (this.queue.length === 0 && !this.closed) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }

    return this.queue.splice(0, maxMessages).map((queued) => this.toReceivedMessage(queued.payload));
  }

  async close(): Promise<void> {
    this.closed = true;
    this.flushWaiters();
    if (this.connected) {
      await this.consumer.disconnect();
      this.connected = false;
    }
  }

  private async ensureStarted(): Promise<void> {
    if (this.connected) return;
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: this.topic, fromBeginning: this.fromBeginning });
    await this.consumer.run({
      autoCommit: false,
      eachMessage: async (payload) => {
        this.queue.push({ payload });
        this.flushWaiters();
      },
    });
    this.connected = true;
  }

  private toReceivedMessage(payload: EachMessagePayload): ReceivedMessage {
    const envelope = parseKafkaEnvelope(payload.message);
    return {
      envelope,
      raw: payload,
      attributes: {
        topic: payload.topic,
        partition: payload.partition,
        offset: payload.message.offset,
        headers: payload.message.headers,
      },
      ack: async () => {
        await this.consumer.commitOffsets([
          {
            topic: payload.topic,
            partition: payload.partition,
            offset: nextOffset(payload.message.offset),
          },
        ]);
      },
      retry: async () => {
        // Keep the offset uncommitted so the consumer group can retry according to Kafka semantics.
      },
    };
  }

  private flushWaiters(): void {
    const waiters = this.waiters.splice(0);
    for (const waiter of waiters) waiter();
  }
}

function parseKafkaEnvelope(message: KafkaMessage): EventEnvelope {
  const value = message.value?.toString("utf8");
  if (!value) throw new Error("Kafka message value is empty");
  const parsed = JSON.parse(value) as EventEnvelope;
  if (!parsed.eventId || !parsed.version || !parsed.metadata) {
    throw new Error("Kafka message value is not an EventEnvelope");
  }
  return parsed;
}

function nextOffset(offset: string): string {
  return (BigInt(offset) + 1n).toString();
}
