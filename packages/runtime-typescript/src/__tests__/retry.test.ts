import { describe, it, expect, vi } from "vitest";
import { withRetry } from "../middleware/retry.js";
import { buildEnvelope } from "../index.js";
import type { TransportAdapter } from "../types.js";

const envelope = buildEnvelope("test.event", "1.0.0", {});

function failingAdapter(failTimes: number): TransportAdapter & { calls: number } {
  let calls = 0;
  return {
    get calls() { return calls; },
    async publish() {
      calls++;
      if (calls <= failTimes) throw new Error(`fail #${calls}`);
      return { messageId: "ok" };
    },
  };
}

describe("withRetry", () => {
  it("succeeds on first attempt when adapter works", async () => {
    const base = failingAdapter(0);
    const transport = withRetry(base, { maxAttempts: 3, delayMs: 0 });
    const result = await transport.publish(envelope);
    expect(result.messageId).toBe("ok");
    expect(base.calls).toBe(1);
  });

  it("retries and succeeds within maxAttempts", async () => {
    const base = failingAdapter(2);
    const transport = withRetry(base, { maxAttempts: 3, delayMs: 0 });
    const result = await transport.publish(envelope);
    expect(result.messageId).toBe("ok");
    expect(base.calls).toBe(3);
  });

  it("throws after exhausting all attempts", async () => {
    const base = failingAdapter(5);
    const transport = withRetry(base, { maxAttempts: 3, delayMs: 0 });
    await expect(transport.publish(envelope)).rejects.toThrow("fail #3");
    expect(base.calls).toBe(3);
  });

  it("uses fixed backoff when specified", async () => {
    const base = failingAdapter(2);
    const transport = withRetry(base, { maxAttempts: 3, delayMs: 0, backoff: "fixed" });
    await transport.publish(envelope);
    expect(base.calls).toBe(3);
  });
});
