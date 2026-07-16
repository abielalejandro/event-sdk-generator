import type { EventConsumer, MessageSource, ReceivedMessage } from "./types.js";

export type MessageAction = "ack" | "retry" | "deadLetter" | "ignore";

export type ConsumerRunnerOptions = {
  source: MessageSource;
  consumer: EventConsumer;
  concurrency?: number;
  idleDelayMs?: number;
  unhandled?: MessageAction;
  handlerError?: MessageAction;
  onError?: (error: unknown, message?: ReceivedMessage) => void | Promise<void>;
};

export class ConsumerRunner {
  private readonly source: MessageSource;
  private readonly consumer: EventConsumer;
  private readonly concurrency: number;
  private readonly idleDelayMs: number;
  private readonly unhandled: MessageAction;
  private readonly handlerError: MessageAction;
  private readonly onError?: (error: unknown, message?: ReceivedMessage) => void | Promise<void>;
  private running = false;
  private loopPromise?: Promise<void>;

  constructor(options: ConsumerRunnerOptions) {
    this.source = options.source;
    this.consumer = options.consumer;
    this.concurrency = Math.max(1, options.concurrency ?? 1);
    this.idleDelayMs = Math.max(0, options.idleDelayMs ?? 1000);
    this.unhandled = options.unhandled ?? "ack";
    this.handlerError = options.handlerError ?? "retry";
    this.onError = options.onError;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.loopPromise = this.loop();
  }

  async stop(): Promise<void> {
    this.running = false;
    await this.source.close?.();
    await this.loopPromise;
  }

  async wait(): Promise<void> {
    await this.loopPromise;
  }

  private async loop(): Promise<void> {
    while (this.running) {
      let messages: ReceivedMessage[] = [];
      try {
        messages = await this.source.receive({ maxMessages: this.concurrency });
      } catch (error) {
        await this.report(error);
        await delay(this.idleDelayMs);
        continue;
      }

      if (messages.length === 0) {
        await delay(this.idleDelayMs);
        continue;
      }

      await Promise.all(messages.slice(0, this.concurrency).map((message) => this.process(message)));
    }
  }

  private async process(message: ReceivedMessage): Promise<void> {
    try {
      const handled = await this.consumer.handle(message.envelope);
      if (handled) {
        await message.ack();
        return;
      }
      await this.applyAction(this.unhandled, message);
    } catch (error) {
      await this.report(error, message);
      await this.applyAction(this.handlerError, message, error);
    }
  }

  private async applyAction(action: MessageAction, message: ReceivedMessage, error?: unknown): Promise<void> {
    if (action === "ack") {
      await message.ack();
    } else if (action === "retry") {
      await message.retry(error);
    } else if (action === "deadLetter") {
      if (message.deadLetter) {
        await message.deadLetter(error);
      } else {
        await message.retry(error);
      }
    }
  }

  private async report(error: unknown, message?: ReceivedMessage): Promise<void> {
    try {
      await this.onError?.(error, message);
    } catch {
      // Error hooks must not crash the runner loop.
    }
  }
}

export function runConsumer(options: ConsumerRunnerOptions): ConsumerRunner {
  return new ConsumerRunner(options);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}
