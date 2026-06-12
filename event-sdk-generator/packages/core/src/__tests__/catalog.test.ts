import { describe, it, expect } from "vitest";
import { buildCatalog, type EventDefinition, type BindingFile } from "../index.js";

const event: EventDefinition = {
  id: "payment.created",
  version: "1.0.0",
  domain: "payments",
  name: "Payment Created",
  description: "A payment was created",
  payloadSchema: { type: "object", properties: {} },
};

const bindings: BindingFile = {
  environment: "dev",
  bindings: [{ eventId: "payment.created", version: "1.0.0", destination: { provider: "aws.sns", topicArn: "arn:x" } }],
};

describe("buildCatalog", () => {
  it("includes generatedAt and environment", () => {
    const catalog = buildCatalog([event], bindings);
    expect(catalog.environment).toBe("dev");
    expect(catalog.generatedAt).toBeTruthy();
  });

  it("attaches destination from matching binding", () => {
    const catalog = buildCatalog([event], bindings);
    expect(catalog.events[0].destination?.provider).toBe("aws.sns");
  });

  it("leaves destination undefined when no binding matches", () => {
    const emptyBindings: BindingFile = { environment: "dev", bindings: [] };
    const catalog = buildCatalog([event], emptyBindings);
    expect(catalog.events[0].destination).toBeUndefined();
  });

  it("generates correct typescript usage string", () => {
    const catalog = buildCatalog([event], bindings);
    expect(catalog.events[0].usage.typescript).toBe("await client.payments.paymentCreated.publish(payload);");
  });

  it("generates correct java usage string", () => {
    const catalog = buildCatalog([event], bindings);
    expect(catalog.events[0].usage.java).toBe("client.payments().paymentCreated().publish(payload);");
  });
});
