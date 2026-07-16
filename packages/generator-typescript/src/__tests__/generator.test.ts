import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { generateTypeScriptSdk } from "../index.js";
import type { EventDefinition, BindingFile } from "@eventgen/core";

const event: EventDefinition = {
  id: "payment.created",
  version: "1.0.0",
  domain: "payments",
  name: "Payment Created",
  description: "Test event",
  consumers: ["billing-service", "notification-service"],
  payloadSchema: {
    type: "object",
    properties: {
      paymentId: { type: "string" },
      amount: { type: "number" },
    },
  },
};

const bindings: BindingFile = {
  environment: "test",
  bindings: [],
};

let outDir: string;

beforeAll(() => {
  outDir = fs.mkdtempSync(path.join(os.tmpdir(), "eventgen-ts-"));
  generateTypeScriptSdk({ events: [event], bindings, outDir });
});

describe("TypeScript SDK generator", () => {
  it("generates package.json with runtime dependency", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(outDir, "package.json"), "utf8"));
    expect(pkg.dependencies["@eventgen/runtime-typescript"]).toBeTruthy();
  });

  it("generates runtime.ts re-exporting from runtime package", () => {
    const runtime = fs.readFileSync(path.join(outDir, "src", "runtime.ts"), "utf8");
    expect(runtime).toContain("@eventgen/runtime-typescript");
    expect(runtime).toContain("buildEnvelope");
  });

  it("generates typed payload for the event", () => {
    const src = fs.readFileSync(path.join(outDir, "src", "events", "payment-created.ts"), "utf8");
    expect(src).toContain("PaymentsPaymentCreatedPayload");
    expect(src).toContain("paymentId: string");
    expect(src).toContain("amount: number");
  });

  it("generates factory function with publish method", () => {
    const src = fs.readFileSync(path.join(outDir, "src", "events", "payment-created.ts"), "utf8");
    expect(src).toContain("createPaymentsPaymentCreated");
    expect(src).toContain("publish(payload");
    expect(src).toContain("buildEnvelope");
  });

  it("generates typed consumer handlers for the event", () => {
    const src = fs.readFileSync(path.join(outDir, "src", "events", "payment-created.ts"), "utf8");
    expect(src).toContain("PaymentsPaymentCreatedHandler");
    expect(src).toContain('["billing-service","notification-service"] as const');
    expect(src).toContain("createPaymentsPaymentCreatedConsumer");
    expect(src).toContain("async handle(envelope: EventEnvelope)");
  });

  it("generates index.ts with createClient factory", () => {
    const index = fs.readFileSync(path.join(outDir, "src", "index.ts"), "utf8");
    expect(index).toContain("createClient");
    expect(index).toContain("payments");
    expect(index).toContain("paymentCreated");
  });

  it("generates index.ts with createConsumer router", () => {
    const index = fs.readFileSync(path.join(outDir, "src", "index.ts"), "utf8");
    expect(index).toContain("createConsumer");
    expect(index).toContain("EventConsumerHandlers");
    expect(index).toContain('routes.set("payment.created@1.0.0"');
    expect(index).toContain("Promise<boolean>");
  });
});
