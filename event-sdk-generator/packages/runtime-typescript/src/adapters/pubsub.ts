import { PubSub } from "@google-cloud/pubsub";
import type { TransportAdapter, EventEnvelope, PublishResult } from "../types.js";

export type PubSubTransportAdapterOptions = {
  topicName: string;
  projectId?: string;
  /** Pass an existing PubSub instance to share credentials */
  pubsub?: PubSub;
};

export class PubSubTransportAdapter implements TransportAdapter {
  private readonly pubsub: PubSub;
  private readonly topicName: string;

  constructor(options: PubSubTransportAdapterOptions) {
    this.topicName = options.topicName;
    this.pubsub = options.pubsub ?? new PubSub({ projectId: options.projectId });
  }

  async publish(envelope: EventEnvelope): Promise<PublishResult> {
    const data = Buffer.from(JSON.stringify(envelope));
    const messageId = await this.pubsub.topic(this.topicName).publishMessage({
      data,
      attributes: {
        eventId: envelope.eventId,
        version: envelope.version,
        traceId: envelope.metadata.traceId,
      },
    });
    return { messageId };
  }
}
