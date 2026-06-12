import amqp from "amqplib";
import type { TransportAdapter, EventEnvelope, PublishResult } from "../types.js";

export type RabbitMQTransportAdapterOptions = {
  url: string;
  exchange: string;
  /** Defaults to envelope.eventId if omitted */
  routingKey?: string;
};

export class RabbitMQTransportAdapter implements TransportAdapter {
  private readonly url: string;
  private readonly exchange: string;
  private readonly routingKey?: string;
  private model: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;

  constructor(options: RabbitMQTransportAdapterOptions) {
    this.url = options.url;
    this.exchange = options.exchange;
    this.routingKey = options.routingKey;
  }

  private async getChannel(): Promise<amqp.Channel> {
    if (!this.channel) {
      this.model = await amqp.connect(this.url);
      this.channel = await this.model.createChannel();
    }
    return this.channel;
  }

  async publish(envelope: EventEnvelope): Promise<PublishResult> {
    const channel = await this.getChannel();
    const messageId = crypto.randomUUID();
    const content = Buffer.from(JSON.stringify(envelope));

    channel.publish(
      this.exchange,
      this.routingKey ?? envelope.eventId,
      content,
      {
        contentType: "application/json",
        messageId,
        headers: {
          eventId: envelope.eventId,
          version: envelope.version,
          traceId: envelope.metadata.traceId,
        },
      }
    );

    return { messageId };
  }

  async close(): Promise<void> {
    await this.channel?.close();
    await this.model?.close();
    this.channel = null;
    this.model = null;
  }
}
