import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { generatePythonSdk } from "../index.js";
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
      payment_id: { type: "string" },
      amount: { type: "number" },
    },
  },
};

const bindings: BindingFile = { environment: "test", bindings: [] };
let outDir: string;
let pkgDir: string;

beforeAll(() => {
  outDir = fs.mkdtempSync(path.join(os.tmpdir(), "eventgen-py-"));
  generatePythonSdk({ events: [event], bindings, outDir, packageName: "company_events" });
  pkgDir = path.join(outDir, "company_events");
});

describe("Python SDK generator", () => {
  it("generates pyproject.toml with runtime dependency", () => {
    const toml = fs.readFileSync(path.join(outDir, "pyproject.toml"), "utf8");
    expect(toml).toContain("eventgen-runtime-python");
  });

  it("generates dataclass payload with Decimal for number fields", () => {
    const src = fs.readFileSync(path.join(pkgDir, "events", "payment_created.py"), "utf8");
    expect(src).toContain("@dataclass");
    expect(src).toContain("class PaymentsPaymentCreatedPayload");
    expect(src).toContain("from decimal import Decimal");
    expect(src).toContain("amount: Decimal");
  });

  it("generates async publish method using build_envelope", () => {
    const src = fs.readFileSync(path.join(pkgDir, "events", "payment_created.py"), "utf8");
    expect(src).toContain("async def publish");
    expect(src).toContain("build_envelope");
    expect(src).toContain("payment.created");
  });

  it("generates __init__.py with create_client factory", () => {
    const init = fs.readFileSync(path.join(pkgDir, "__init__.py"), "utf8");
    expect(init).toContain("def create_client");
    expect(init).toContain("payments");
    expect(init).toContain("payment_created");
  });

  it("creates __init__.py in events subpackage", () => {
    expect(fs.existsSync(path.join(pkgDir, "events", "__init__.py"))).toBe(true);
  });
});
