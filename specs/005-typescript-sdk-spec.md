# TypeScript SDK Spec

El SDK TypeScript debe exponer funciones tipadas para publicar eventos.

```ts
await client.payments.paymentCreated.publish({
  paymentId: "pay_123",
  userId: "usr_456",
  amount: 100
});
```
