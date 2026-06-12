import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import type { TransportAdapter, EventEnvelope, PublishResult } from "../types.js";

export type EventBridgeTransportAdapterOptions = {
  eventBusName: string;
  /** Defaults to envelope.eventId if omitted */
  source?: string;
  region?: string;
  client?: EventBridgeClient;
};

export class EventBridgeTransportAdapter implements TransportAdapter {
  private readonly client: EventBridgeClient;
  private readonly eventBusName: string;
  private readonly source?: string;

  constructor(options: EventBridgeTransportAdapterOptions) {
    this.eventBusName = options.eventBusName;
    this.source = options.source;
    this.client = options.client ?? new EventBridgeClient({ region: options.region ?? process.env["AWS_REGION"] ?? "us-east-1" });
  }

  async publish(envelope: EventEnvelope): Promise<PublishResult> {
    const result = await this.client.send(
      new PutEventsCommand({
        Entries: [
          {
            EventBusName: this.eventBusName,
            Source: this.source ?? envelope.eventId,
            DetailType: envelope.eventId,
            Detail: JSON.stringify(envelope),
            Time: new Date(envelope.metadata.createdAt),
          },
        ],
      })
    );

    if (result.FailedEntryCount && result.FailedEntryCount > 0) {
      const failed = result.Entries?.[0];
      throw new Error(`EventBridge publish failed for ${envelope.eventId}: ${failed?.ErrorCode} — ${failed?.ErrorMessage}`);
    }

    return { messageId: result.Entries?.[0]?.EventId };
  }
}
