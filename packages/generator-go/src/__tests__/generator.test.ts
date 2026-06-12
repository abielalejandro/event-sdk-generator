import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { generateGoSdk } from "../index.js";
import type { EventDefinition, BindingFile } from "@eventgen/core";

const event: EventDefinition = {
  id: "payment.created",
  version: "1.0.0",
  domain: "payments",
  name: "Payment Created",
  description: "Test event",
  payloadSchema: {
    type: "object",
    properties: {
      paymentId: { type: "string" },
      amount: { type: "number" },
    },
  },
};

const bindings: BindingFile = { environment: "test", bindings: [] };
let outDir: string;

beforeAll(() => {
  outDir = fs.mkdtempSync(path.join(os.tmpdir(), "eventgen-go-"));
  generateGoSdk({ events: [event], bindings, outDir, modulePath: "github.com/test/events" });
});

describe("Go SDK generator", () => {
  it("generates go.mod with runtime dependency", () => {
    const mod = fs.readFileSync(path.join(outDir, "go.mod"), "utf8");
    expect(mod).toContain("github.com/eventgen/runtime-go");
    expect(mod).toContain("module github.com/test/events");
  });

  it("generates client.go with NewClient and domain method", () => {
    const src = fs.readFileSync(path.join(outDir, "client.go"), "utf8");
    expect(src).toContain("func NewClient(transport runtime.TransportAdapter) *Client");
    expect(src).toContain("func (c *Client) Payments() *PaymentsEvents");
  });

  it("generates payload struct with json tags", () => {
    const src = fs.readFileSync(path.join(outDir, "payments", "payment_created.go"), "utf8");
    expect(src).toContain("type PaymentCreatedPayload struct");
    expect(src).toContain('json:"paymentId"');
    expect(src).toContain("Amount float64");
  });

  it("generates publisher with Publish method", () => {
    const src = fs.readFileSync(path.join(outDir, "payments", "payment_created.go"), "utf8");
    expect(src).toContain("type PaymentCreatedPublisher struct");
    expect(src).toContain("func (p *PaymentCreatedPublisher) Publish(ctx context.Context");
    expect(src).toContain('runtime.BuildEnvelope("payment.created"');
  });

  it("generates domain event method in client", () => {
    const src = fs.readFileSync(path.join(outDir, "client.go"), "utf8");
    expect(src).toContain("func (e *PaymentsEvents) PaymentCreated() *payments.PaymentCreatedPublisher");
  });
});
