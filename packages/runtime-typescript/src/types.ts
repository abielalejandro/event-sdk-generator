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

export type ReceiveOptions = {
  maxMessages?: number;
};

export type ReceivedMessage = {
  envelope: EventEnvelope;
  raw: unknown;
  attributes?: Record<string, unknown>;
  ack(): Promise<void>;
  retry(error?: unknown): Promise<void>;
  deadLetter?(error?: unknown): Promise<void>;
};

export interface MessageSource {
  receive(options?: ReceiveOptions): Promise<ReceivedMessage[]>;
  close?(): Promise<void>;
}

export interface EventConsumer {
  handle(envelope: EventEnvelope): Promise<boolean> | boolean;
}

export interface Logger {
  info(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}
