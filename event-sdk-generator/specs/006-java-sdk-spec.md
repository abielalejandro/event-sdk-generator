# Java SDK Spec

El SDK Java debe exponer payloads y publishers compatibles con entornos Java empresariales.

```java
PaymentCreatedPayload payload = PaymentCreatedPayload.builder()
    .paymentId("pay_123")
    .userId("usr_456")
    .amount(BigDecimal.valueOf(100))
    .build();

client.payments().paymentCreated().publish(payload);
```
