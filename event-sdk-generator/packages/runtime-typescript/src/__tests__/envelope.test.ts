import { describe, it, expect } from "vitest";
import { buildEnvelope } from "../index.js";

describe("buildEnvelope", () => {
  it("sets eventId and version", () => {
    const e = buildEnvelope("payment.created", "1.0.0", { amount: 100 });
    expect(e.eventId).toBe("payment.created");
    expect(e.version).toBe("1.0.0");
    expect(e.payload).toEqual({ amount: 100 });
  });

  it("generates createdAt as ISO-8601", () => {
    const e = buildEnvelope("x", "1", {});
    expect(() => new Date(e.metadata.createdAt)).not.toThrow();
    expect(new Date(e.metadata.createdAt).toISOString()).toBe(e.metadata.createdAt);
  });

  it("generates a traceId when not provided", () => {
    const e = buildEnvelope("x", "1", {});
    expect(e.metadata.traceId).toBeTruthy();
    expect(e.metadata.traceId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("uses provided traceId", () => {
    const e = buildEnvelope("x", "1", {}, "my-trace-id");
    expect(e.metadata.traceId).toBe("my-trace-id");
  });

  it("two envelopes have different traceIds", () => {
    const e1 = buildEnvelope("x", "1", {});
    const e2 = buildEnvelope("x", "1", {});
    expect(e1.metadata.traceId).not.toBe(e2.metadata.traceId);
  });
});
