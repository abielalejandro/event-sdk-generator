import { describe, it, expect } from "vitest";
import { validateDefinitions, validateBindings, type EventDefinition, type BindingFile } from "../index.js";

const validEvent: EventDefinition = {
  id: "payment.created",
  version: "1.0.0",
  domain: "payments",
  name: "Payment Created",
  description: "Emitted when a payment is created",
  payloadSchema: {
    type: "object",
    required: ["paymentId"],
    properties: { paymentId: { type: "string" } },
  },
};

const validBindings: BindingFile = {
  environment: "dev",
  bindings: [{ eventId: "payment.created", version: "1.0.0", destination: { provider: "aws.sns", topicArn: "arn:aws:sns:us-east-1:123:payments" } }],
};

describe("validateDefinitions", () => {
  it("returns empty array for valid event", () => {
    expect(validateDefinitions([validEvent])).toEqual([]);
  });

  it("reports missing required fields", () => {
    const errors = validateDefinitions([{ id: "bad" } as unknown as EventDefinition]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("bad");
  });

  it("reports invalid payloadSchema", () => {
    const broken = { ...validEvent, payloadSchema: { type: "not-a-valid-type" } };
    const errors = validateDefinitions([broken]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("payloadSchema is not valid JSON Schema");
  });

  it("accepts multiple valid events", () => {
    const second = { ...validEvent, id: "order.placed", name: "Order Placed" };
    expect(validateDefinitions([validEvent, second])).toEqual([]);
  });
});

describe("validateBindings", () => {
  it("returns empty array when all bindings match definitions", () => {
    expect(validateBindings(validBindings, [validEvent])).toEqual([]);
  });

  it("reports binding referencing unknown event", () => {
    const badBindings: BindingFile = {
      environment: "dev",
      bindings: [{ eventId: "order.placed", version: "2.0.0", destination: { provider: "aws.sns", topicArn: "arn:x" } }],
    };
    const errors = validateBindings(badBindings, [validEvent]);
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain("order.placed");
  });

  it("reports binding missing provider", () => {
    const badBindings: BindingFile = {
      environment: "dev",
      bindings: [{ eventId: "payment.created", version: "1.0.0", destination: { provider: "" } }],
    };
    const errors = validateBindings(badBindings, [validEvent]);
    expect(errors.some((e) => e.includes("provider"))).toBe(true);
  });

  it("reports version mismatch", () => {
    const badBindings: BindingFile = {
      environment: "dev",
      bindings: [{ eventId: "payment.created", version: "9.0.0", destination: { provider: "aws.sns", topicArn: "arn:x" } }],
    };
    const errors = validateBindings(badBindings, [validEvent]);
    expect(errors.length).toBe(1);
  });
});
