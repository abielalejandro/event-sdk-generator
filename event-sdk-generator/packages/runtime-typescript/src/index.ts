export type { TransportAdapter, EventEnvelope, PublishResult, Logger } from "./types.js";
export { SnsTransportAdapter } from "./adapters/sns.js";
export type { SnsTransportAdapterOptions } from "./adapters/sns.js";
export { SqsTransportAdapter } from "./adapters/sqs.js";
export type { SqsTransportAdapterOptions } from "./adapters/sqs.js";
export { EventBridgeTransportAdapter } from "./adapters/eventbridge.js";
export type { EventBridgeTransportAdapterOptions } from "./adapters/eventbridge.js";
export { KafkaTransportAdapter } from "./adapters/kafka.js";
export type { KafkaTransportAdapterOptions } from "./adapters/kafka.js";
export { PubSubTransportAdapter } from "./adapters/pubsub.js";
export type { PubSubTransportAdapterOptions } from "./adapters/pubsub.js";
export { ServiceBusTransportAdapter } from "./adapters/servicebus.js";
export type { ServiceBusTransportAdapterOptions } from "./adapters/servicebus.js";
export { RabbitMQTransportAdapter } from "./adapters/rabbitmq.js";
export type { RabbitMQTransportAdapterOptions } from "./adapters/rabbitmq.js";
export { InMemoryTransportAdapter } from "./adapters/memory.js";
export type { RecordedEvent } from "./adapters/memory.js";
export { withRetry } from "./middleware/retry.js";
export type { RetryOptions } from "./middleware/retry.js";
export { withLogging } from "./middleware/logging.js";

import type { EventEnvelope } from "./types.js";

export function buildEnvelope(eventId: string, version: string, payload: unknown, traceId?: string): EventEnvelope {
  return {
    eventId,
    version,
    payload,
    metadata: {
      createdAt: new Date().toISOString(),
      traceId: traceId ?? crypto.randomUUID(),
    },
  };
}
