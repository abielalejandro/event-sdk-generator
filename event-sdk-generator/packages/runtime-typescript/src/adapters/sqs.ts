import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import type { TransportAdapter, EventEnvelope, PublishResult } from "../types.js";

export type SqsTransportAdapterOptions = {
  queueUrl: string;
  region?: string;
  client?: SQSClient;
};

export class SqsTransportAdapter implements TransportAdapter {
  private readonly client: SQSClient;
  private readonly queueUrl: string;

  constructor(options: SqsTransportAdapterOptions) {
    this.queueUrl = options.queueUrl;
    this.client = options.client ?? new SQSClient({ region: options.region ?? process.env["AWS_REGION"] ?? "us-east-1" });
  }

  async publish(envelope: EventEnvelope): Promise<PublishResult> {
    const result = await this.client.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(envelope),
        MessageAttributes: {
          eventId: { DataType: "String", StringValue: envelope.eventId },
          version: { DataType: "String", StringValue: envelope.version },
        },
      })
    );
    return { messageId: result.MessageId };
  }
}
