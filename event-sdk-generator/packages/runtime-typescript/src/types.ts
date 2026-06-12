export type PublishResult = {
  messageId?: string;
};

export type EventEnvelope = {
  eventId: string;
  version: string;
  payload: unknown;
  metadata: {
    createdAt: string;
    traceId: string;
  };
};

export interface TransportAdapter {
  publish(envelope: EventEnvelope): Promise<PublishResult>;
}

export interface Logger {
  info(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}
