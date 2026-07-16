import {
  ChangeMessageVisibilityCommand,
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
  type Message,
} from "@aws-sdk/client-sqs";
import type { EventEnvelope, MessageSource, ReceiveOptions, ReceivedMessage } from "../types.js";

export type SqsMessageSourceOptions = {
  queueUrl: string;
  region?: string;
  client?: SQSClient;
  waitTimeSeconds?: number;
  visibilityTimeoutSeconds?: number;
};

export class SqsMessageSource implements MessageSource {
  private readonly client: SQSClient;
  private readonly queueUrl: string;
  private readonly waitTimeSeconds: number;
  private readonly visibilityTimeoutSeconds?: number;

  constructor(options: SqsMessageSourceOptions) {
    this.queueUrl = options.queueUrl;
    this.waitTimeSeconds = options.waitTimeSeconds ?? 20;
    this.visibilityTimeoutSeconds = options.visibilityTimeoutSeconds;
    this.client = options.client ?? new SQSClient({ region: options.region ?? process.env["AWS_REGION"] ?? "us-east-1" });
  }

  async receive(options?: ReceiveOptions): Promise<ReceivedMessage[]> {
    const maxMessages = Math.min(10, Math.max(1, options?.maxMessages ?? 1));
    const response = await this.client.send(
      new ReceiveMessageCommand({
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: maxMessages,
        WaitTimeSeconds: this.waitTimeSeconds,
        VisibilityTimeout: this.visibilityTimeoutSeconds,
        MessageAttributeNames: ["All"],
        AttributeNames: ["All"],
      })
    );

    return (response.Messages ?? []).map((message) => this.toReceivedMessage(message));
  }

  private toReceivedMessage(message: Message): ReceivedMessage {
    const envelope = parseEnvelope(message.Body);
    const receiptHandle = message.ReceiptHandle;
    return {
      envelope,
      raw: message,
      attributes: {
        messageId: message.MessageId,
        attributes: message.Attributes,
        messageAttributes: message.MessageAttributes,
      },
      ack: async () => {
        if (!receiptHandle) return;
        await this.client.send(new DeleteMessageCommand({ QueueUrl: this.queueUrl, ReceiptHandle: receiptHandle }));
      },
      retry: async () => {
        if (!receiptHandle) return;
        await this.client.send(
          new ChangeMessageVisibilityCommand({
            QueueUrl: this.queueUrl,
            ReceiptHandle: receiptHandle,
            VisibilityTimeout: 0,
          })
        );
      },
    };
  }
}

function parseEnvelope(body: string | undefined): EventEnvelope {
  if (!body) throw new Error("SQS message body is empty");
  const parsed = JSON.parse(body) as EventEnvelope;
  if (!parsed.eventId || !parsed.version || !parsed.metadata) {
    throw new Error("SQS message body is not an EventEnvelope");
  }
  return parsed;
}
