import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EventList } from "./EventList";

const event = {
  id: "payment.created",
  version: "1.0.0",
  domain: "payments",
  description: "Payment created",
  producer: "payment-service",
  consumers: ["billing-service"],
  destination: { provider: "aws.sns" },
  usage: {
    typescript: "await client.payments.paymentCreated.publish(payload);",
    java: "client.payments().paymentCreated().publish(payload);",
    python: "await client.payments.payment_created.publish(payload)",
    go: "client.Payments().PaymentCreated().Publish(ctx, payload)",
  },
  consumerUsage: {
    typescript: "const consumer = createConsumer({ payments: { paymentCreated: handlePaymentCreated } });",
    java: "EventConsumer consumer = EventConsumer.builder().build();",
    python: "consumer = create_consumer(payments={\"payment_created\": handle_payment_created})",
    go: "consumer := events.NewConsumer(events.ConsumerHandlers{})",
  },
  backgroundConsumerUsage: {
    typescript: "const runner = runConsumer({ source, consumer });",
    java: "ConsumerRunner runner = ConsumerRunner.builder().source(source).consumer(consumer).build();",
    python: "runner = run_consumer(source=source, consumer=consumer)",
    go: "runner := runtime.NewConsumerRunner(source, consumer, runtime.ConsumerRunnerOptions{})",
  },
  payloadSchema: { type: "object" },
};

describe("EventList", () => {
  it("shows publisher, consumer, and background job usage sections", () => {
    const html = renderToStaticMarkup(createElement(EventList, { events: [event] }));

    expect(html).toContain("Publisher");
    expect(html).toContain("Consumer");
    expect(html).toContain("Background job");
  });

  it("renders background job examples for every generated language", () => {
    const html = renderToStaticMarkup(createElement(EventList, { events: [event] }));

    expect(html).toContain("runConsumer");
    expect(html).toContain("ConsumerRunner");
    expect(html).toContain("run_consumer");
    expect(html).toContain("NewConsumerRunner");
  });
});
