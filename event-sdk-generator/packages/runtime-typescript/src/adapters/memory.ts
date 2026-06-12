import type { TransportAdapter, EventEnvelope, PublishResult } from "../types.js";

export type RecordedEvent = {
  envelope: EventEnvelope;
  publishedAt: Date;
};

export class InMemoryTransportAdapter implements TransportAdapter {
  readonly published: RecordedEvent[] = [];

  async publish(envelope: EventEnvelope): Promise<PublishResult> {
    const messageId = `mem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.published.push({ envelope, publishedAt: new Date() });
    return { messageId };
  }

  clear(): void {
    this.published.length = 0;
  }
}
