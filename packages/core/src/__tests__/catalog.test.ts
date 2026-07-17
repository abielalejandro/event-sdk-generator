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

  it("generates correct python usage string", () => {
    const catalog = buildCatalog([event], bindings);
    expect(catalog.events[0].usage.python).toBe("await client.payments.payment_created.publish(payload)");
  });

  it("generates correct go usage string", () => {
    const catalog = buildCatalog([event], bindings);
    expect(catalog.events[0].usage.go).toBe("client.Payments().PaymentCreated().Publish(ctx, payload)");
  });

  it("generates correct typescript consumer usage string", () => {
    const catalog = buildCatalog([event], bindings);
    expect(catalog.events[0].consumerUsage.typescript).toContain("createConsumer");
    expect(catalog.events[0].consumerUsage.typescript).toContain("paymentCreated");
    expect(catalog.events[0].consumerUsage.typescript).toContain("consumer.handle(envelope)");
  });

  it("generates correct java consumer usage string", () => {
    const catalog = buildCatalog([event], bindings);
    expect(catalog.events[0].consumerUsage.java).toContain("EventConsumer.builder()");
    expect(catalog.events[0].consumerUsage.java).toContain(".paymentCreated");
  });

  it("generates correct python consumer usage string", () => {
    const catalog = buildCatalog([event], bindings);
    expect(catalog.events[0].consumerUsage.python).toBe('consumer = create_consumer(payments={"payment_created": handle_payment_created})\nawait consumer.handle(envelope)');
  });

  it("generates correct go consumer usage string", () => {
    const catalog = buildCatalog([event], bindings);
    expect(catalog.events[0].consumerUsage.go).toContain("events.NewConsumer");
    expect(catalog.events[0].consumerUsage.go).toContain("PaymentCreated: handlePaymentCreated");
  });

  it("generates background consumer usage strings", () => {
    const catalog = buildCatalog([event], bindings);
    expect(catalog.events[0].backgroundConsumerUsage.typescript).toContain("runConsumer");
    expect(catalog.events[0].backgroundConsumerUsage.typescript).toContain("SqsMessageSource");
    expect(catalog.events[0].backgroundConsumerUsage.java).toContain("ConsumerRunner.builder()");
    expect(catalog.events[0].backgroundConsumerUsage.python).toContain("run_consumer");
    expect(catalog.events[0].backgroundConsumerUsage.go).toContain("runtime.NewConsumerRunner");
  });
});
