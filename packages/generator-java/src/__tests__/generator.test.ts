import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { generateJavaSdk } from "../index.js";
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
const javaPackage = "com.test.events";
let outDir: string;
let base: string;

beforeAll(() => {
  outDir = fs.mkdtempSync(path.join(os.tmpdir(), "eventgen-java-"));
  generateJavaSdk({ events: [event], bindings, outDir, javaPackage });
  base = path.join(outDir, "src", "main", "java", "com", "test", "events");
});

describe("Java SDK generator", () => {
  it("generates pom.xml with runtime-java dependency", () => {
    const pom = fs.readFileSync(path.join(outDir, "pom.xml"), "utf8");
    expect(pom).toContain("runtime-java");
    expect(pom).toContain("com.eventgen");
  });

  it("generates Payload class with builder", () => {
    const src = fs.readFileSync(path.join(base, "PaymentsCreatedPayload.java"), "utf8");
    expect(src).toContain("class PaymentsCreatedPayload");
    expect(src).toContain("static Builder builder()");
    expect(src).toContain("class Builder");
    expect(src).toContain("public Builder paymentId");
    expect(src).toContain("java.math.BigDecimal amount");
  });

  it("generates Publisher with runtime imports and publish overloads", () => {
    const src = fs.readFileSync(path.join(base, "PaymentsCreatedPublisher.java"), "utf8");
    expect(src).toContain("import com.eventgen.runtime.TransportAdapter");
    expect(src).toContain("import com.eventgen.runtime.EventEnvelope");
    expect(src).toContain("publish(PaymentsCreatedPayload payload)");
    expect(src).toContain("publish(PaymentsCreatedPayload payload, String traceId)");
    expect(src).toContain("UUID.randomUUID()");
  });

  it("generates EventClient with domain method", () => {
    const src = fs.readFileSync(path.join(base, "EventClient.java"), "utf8");
    expect(src).toContain("import com.eventgen.runtime.TransportAdapter");
    expect(src).toContain("public PaymentsEvents payments()");
    expect(src).toContain("paymentCreated()");
  });
});
