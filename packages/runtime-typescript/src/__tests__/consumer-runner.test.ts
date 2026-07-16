import { describe, expect, it, vi } from "vitest";
import { InMemoryMessageSource } from "../adapters/message-memory.js";
import { runConsumer } from "../consumer-runner.js";
import { buildEnvelope } from "../index.js";

describe("ConsumerRunner", () => {
  it("acks messages handled by the consumer", async () => {
    const envelope = buildEnvelope("payment.created", "1.0.0", { paymentId: "pay_1" });
    const source = new InMemoryMessageSource([envelope]);
    const handle = vi.fn().mockResolvedValue(true);

    const runner = runConsumer({
      source,
      consumer: { handle },
      idleDelayMs: 0,
    });

    await runner.start();
    await waitFor(() => source.messages[0].acked);
    await runner.stop();

    expect(handle).toHaveBeenCalledWith(envelope);
    expect(source.messages[0].acked).toBe(true);
  });

  it("applies the unhandled policy when no route matches", async () => {
    const envelope = buildEnvelope("payment.created", "1.0.0", {});
    const source = new InMemoryMessageSource([envelope]);

    const runner = runConsumer({
      source,
      consumer: { handle: async () => false },
      unhandled: "deadLetter",
      idleDelayMs: 0,
    });

    await runner.start();
    await waitFor(() => source.deadLetters.length === 1);
    await runner.stop();

    expect(source.messages[0].deadLettered).toBe(true);
  });

  it("retries handler failures by default", async () => {
    const envelope = buildEnvelope("payment.created", "1.0.0", {});
    const source = new InMemoryMessageSource([envelope]);
    const onError = vi.fn();
    let attempts = 0;

    const runner = runConsumer({
      source,
      consumer: {
        handle: async () => {
          attempts++;
          if (attempts === 1) throw new Error("boom");
          return true;
        },
      },
      onError,
      idleDelayMs: 0,
    });

    await runner.start();
    await waitFor(() => source.messages[0].acked);
    await runner.stop();

    expect(attempts).toBeGreaterThanOrEqual(2);
    expect(onError).toHaveBeenCalledOnce();
  });
});

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let i = 0; i < 50; i++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("condition not met");
}
