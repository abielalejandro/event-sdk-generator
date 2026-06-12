import type { TransportAdapter, EventEnvelope, PublishResult } from "../types.js";

export type RetryOptions = {
  maxAttempts?: number;
  delayMs?: number;
  backoff?: "fixed" | "exponential";
};

export function withRetry(adapter: TransportAdapter, options: RetryOptions = {}): TransportAdapter {
  const { maxAttempts = 3, delayMs = 200, backoff = "exponential" } = options;

  return {
    async publish(envelope: EventEnvelope): Promise<PublishResult> {
      let lastError: unknown;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          return await adapter.publish(envelope);
        } catch (err) {
          lastError = err;
          if (attempt < maxAttempts) {
            const wait = backoff === "exponential" ? delayMs * 2 ** (attempt - 1) : delayMs;
            await new Promise((resolve) => setTimeout(resolve, wait));
          }
        }
      }
      throw lastError;
    },
  };
}
