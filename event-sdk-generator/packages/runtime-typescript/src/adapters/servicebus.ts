import { ServiceBusClient, type ServiceBusSender } from "@azure/service-bus";
import type { TransportAdapter, EventEnvelope, PublishResult } from "../types.js";

export type ServiceBusTransportAdapterOptions = {
  connectionString: string;
  /** Queue name or topic name */
  name: string;
};

export class ServiceBusTransportAdapter implements TransportAdapter {
  private readonly client: ServiceBusClient;
  private readonly sender: ServiceBusSender;

  constructor(options: ServiceBusTransportAdapterOptions) {
    this.client = new ServiceBusClient(options.connectionString);
    this.sender = this.client.createSender(options.name);
  }

  async publish(envelope: EventEnvelope): Promise<PublishResult> {
    const message = {
      body: envelope,
      contentType: "application/json",
      applicationProperties: {
        eventId: envelope.eventId,
        version: envelope.version,
        traceId: envelope.metadata.traceId,
      },
    };
    await this.sender.sendMessages(message);
    return { messageId: undefined };
  }

  async close(): Promise<void> {
    await this.sender.close();
    await this.client.close();
  }
}
