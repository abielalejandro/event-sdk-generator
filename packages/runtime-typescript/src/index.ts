export type {
  TransportAdapter,
  EventEnvelope,
  PublishResult,
  Logger,
  FifoOptions,
  MessageSource,
  ReceiveOptions,
  ReceivedMessage,
  EventConsumer,
} from "./types.js";
export { ConsumerRunner, runConsumer } from "./consumer-runner.js";
export type { ConsumerRunnerOptions, MessageAction } from "./consumer-runner.js";
export { SnsTransportAdapter } from "./adapters/sns.js";
export type { SnsTransportAdapterOptions } from "./adapters/sns.js";
export { SqsTransportAdapter } from "./adapters/sqs.js";
export type { SqsTransportAdapterOptions } from "./adapters/sqs.js";
export { SqsMessageSource } from "./adapters/sqs-source.js";
export type { SqsMessageSourceOptions } from "./adapters/sqs-source.js";
export { EventBridgeTransportAdapter } from "./adapters/eventbridge.js";
export type { EventBridgeTransportAdapterOptions } from "./adapters/eventbridge.js";
export { KafkaTransportAdapter } from "./adapters/kafka.js";
export type { KafkaTransportAdapterOptions } from "./adapters/kafka.js";
export { KafkaMessageSource } from "./adapters/kafka-source.js";
export type { KafkaMessageSourceOptions } from "./adapters/kafka-source.js";
export { PubSubTransportAdapter } from "./adapters/pubsub.js";
export type { PubSubTransportAdapterOptions } from "./adapters/pubsub.js";
export { ServiceBusTransportAdapter } from "./adapters/servicebus.js";
export type { ServiceBusTransportAdapterOptions } from "./adapters/servicebus.js";
export { RabbitMQTransportAdapter } from "./adapters/rabbitmq.js";
export type { RabbitMQTransportAdapterOptions } from "./adapters/rabbitmq.js";
export { InMemoryTransportAdapter } from "./adapters/memory.js";
export type { RecordedEvent } from "./adapters/memory.js";
export { InMemoryMessageSource } from "./adapters/message-memory.js";
export type { InMemoryReceivedRecord } from "./adapters/message-memory.js";
export { withRetry } from "./middleware/retry.js";
export type { RetryOptions } from "./middleware/retry.js";
export { withLogging } from "./middleware/logging.js";

import type { EventEnvelope, FifoOptions } from "./types.js";

export type PublishOptions = {
  traceId?: string;
  fifo?: FifoOptions;
};

export function buildEnvelope(eventId: string, version: string, payload: unknown, opts?: string | PublishOptions): EventEnvelope {
  const traceId = typeof opts === "string" ? opts : opts?.traceId;
  const fifo = typeof opts === "object" ? opts?.fifo : undefined;
  return {
    eventId,
    version,
    payload,
    metadata: {
      createdAt: new Date().toISOString(),
      traceId: traceId ?? crypto.randomUUID(),
      ...(fifo && { fifo }),
    },
  };
}
