import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import type { TransportAdapter, EventEnvelope, PublishResult } from "../types.js";

export type SnsTransportAdapterOptions = {
  topicArn: string;
  region?: string;
  client?: SNSClient;
};

export class SnsTransportAdapter implements TransportAdapter {
  private readonly client: SNSClient;
  private readonly topicArn: string;

  constructor(options: SnsTransportAdapterOptions) {
    this.topicArn = options.topicArn;
    this.client = options.client ?? new SNSClient({ region: options.region ?? process.env["AWS_REGION"] ?? "us-east-1" });
  }

  async publish(envelope: EventEnvelope): Promise<PublishResult> {
    const fifo = envelope.metadata.fifo;
    const result = await this.client.send(
      new PublishCommand({
        TopicArn: this.topicArn,
        Message: JSON.stringify(envelope),
        MessageAttributes: {
          eventId: { DataType: "String", StringValue: envelope.eventId },
          version: { DataType: "String", StringValue: envelope.version },
        },
        ...(fifo && {
          MessageGroupId: fifo.messageGroupId,
          ...(fifo.deduplicationId && { MessageDeduplicationId: fifo.deduplicationId }),
        }),
      })
    );
    return { messageId: result.MessageId };
  }
}
