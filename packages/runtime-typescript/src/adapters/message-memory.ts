import type { EventEnvelope, MessageSource, ReceiveOptions, ReceivedMessage } from "../types.js";

export type InMemoryReceivedRecord = {
  envelope: EventEnvelope;
  attempts: number;
  acked: boolean;
  deadLettered: boolean;
};

export class InMemoryMessageSource implements MessageSource {
  readonly messages: InMemoryReceivedRecord[];
  readonly deadLetters: InMemoryReceivedRecord[] = [];

  constructor(envelopes: EventEnvelope[] = []) {
    this.messages = envelopes.map((envelope) => ({
      envelope,
      attempts: 0,
      acked: false,
      deadLettered: false,
    }));
  }

  enqueue(envelope: EventEnvelope): void {
    this.messages.push({ envelope, attempts: 0, acked: false, deadLettered: false });
  }

  async receive(options?: ReceiveOptions): Promise<ReceivedMessage[]> {
    const maxMessages = Math.max(1, options?.maxMessages ?? 1);
    const records = this.messages.filter((message) => !message.acked && !message.deadLettered).slice(0, maxMessages);
    return records.map((record) => {
      record.attempts++;
      return {
        envelope: record.envelope,
        raw: record,
        ack: async () => {
          record.acked = true;
        },
        retry: async () => {
          // Keep the record available for the next receive call.
        },
        deadLetter: async () => {
          record.deadLettered = true;
          this.deadLetters.push(record);
        },
      };
    });
  }

  clear(): void {
    this.messages.length = 0;
    this.deadLetters.length = 0;
  }
}
