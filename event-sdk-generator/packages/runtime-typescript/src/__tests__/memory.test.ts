import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryTransportAdapter } from "../adapters/memory.js";
import { buildEnvelope } from "../index.js";

describe("InMemoryTransportAdapter", () => {
  let adapter: InMemoryTransportAdapter;

  beforeEach(() => {
    adapter = new InMemoryTransportAdapter();
  });

  it("starts with empty published list", () => {
    expect(adapter.published).toHaveLength(0);
  });

  it("records published events in order", async () => {
    const e1 = buildEnvelope("payment.created", "1.0.0", { amount: 100 });
    const e2 = buildEnvelope("order.placed", "1.0.0", { orderId: "o_1" });
    await adapter.publish(e1);
    await adapter.publish(e2);
    expect(adapter.published).toHaveLength(2);
    expect(adapter.published[0].envelope.eventId).toBe("payment.created");
    expect(adapter.published[1].envelope.eventId).toBe("order.placed");
  });

  it("returns a messageId on each publish", async () => {
    const result = await adapter.publish(buildEnvelope("x", "1", {}));
    expect(result.messageId).toBeTruthy();
  });

  it("clear() resets the list", async () => {
    await adapter.publish(buildEnvelope("x", "1", {}));
    adapter.clear();
    expect(adapter.published).toHaveLength(0);
  });
});
