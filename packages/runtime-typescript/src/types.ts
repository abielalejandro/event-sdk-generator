export type PublishResult = {
  messageId?: string;
};

export type FifoOptions = {
  /** Groups messages for ordered delivery within the group. Required for FIFO queues/topics. */
  messageGroupId: string;
  /** Unique token for deduplication within 5 minutes. If omitted, content-based deduplication must be enabled. */
  deduplicationId?: string;
};

export type EventEnvelope = {
  eventId: string;
  version: string;
  payload: unknown;
  metadata: {
    createdAt: string;
    traceId: string;
    fifo?: FifoOptions;
  };
};

export interface TransportAdapter {
  publish(envelope: EventEnvelope): Promise<PublishResult>;
}

export interface Logger {
  info(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}
