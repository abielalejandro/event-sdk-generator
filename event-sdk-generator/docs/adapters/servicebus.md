# Azure Service Bus — ServiceBusTransportAdapter

Servicio de mensajería empresarial de Azure. Soporta colas (punto a punto) y topics con subscriptions (fan-out), con garantías de entrega, ordering y dead-letter queue integrada.

**Cuándo usarlo:** mensajería confiable en Azure, integración con Azure Functions o Logic Apps, workflows que requieren transacciones o sesiones.

## TypeScript

```ts
import { ServiceBusTransportAdapter, withRetry, withLogging } from "@eventgen/runtime-typescript";
import { createClient } from "@company/generated-events-sdk";

const transport = withLogging(
  withRetry(
    new ServiceBusTransportAdapter({
      connectionString: process.env.SERVICE_BUS_CONNECTION_STRING!,
      name: "payments-queue",   // nombre de queue o topic
    }),
    { maxAttempts: 3 }
  )
);

const client = createClient(transport);

await client.payments.paymentCreated.publish({
  paymentId: "pay_123",
  userId: "usr_456",
  amount: 100,
  currency: "USD",
});

// Cierre explícito al finalizar
await transport.close();
```

### Opciones

| Opción | Tipo | Requerido | Descripción |
|--------|------|-----------|-------------|
| `connectionString` | `string` | ✅ | Connection string del namespace de Service Bus |
| `name` | `string` | ✅ | Nombre de la queue o el topic |

## Java

```java
import com.eventgen.runtime.adapters.ServiceBusTransportAdapter;
import com.company.events.EventClient;

try (ServiceBusTransportAdapter transport = new ServiceBusTransportAdapter(
    System.getenv("SERVICE_BUS_CONNECTION_STRING"),
    "payments-queue"
)) {
    EventClient client = new EventClient(transport);

    PaymentsCreatedPayload payload = PaymentsCreatedPayload.builder()
        .paymentId("pay_123")
        .userId("usr_456")
        .amount(java.math.BigDecimal.valueOf(100))
        .currency("USD")
        .build();

    client.payments().paymentCreated().publish(payload);
}
```

### Constructores

```java
new ServiceBusTransportAdapter(String connectionString, String queueOrTopicName)
new ServiceBusTransportAdapter(ServiceBusSenderClient sender)  // inyección para testing
```

## Formato del mensaje enviado a Service Bus

```
body: <JSON envelope>
contentType: "application/json"
applicationProperties:
  eventId: "payment.created"
  version: "1.0.0"
  traceId: "550e8400-e29b-41d4-a716-446655440000"
```

## Notas

- El `messageId` retornado es el `MessageId` del `ServiceBusMessage` generado automáticamente por el SDK de Azure.
- Service Bus no retorna un ID del servidor al enviar sincrónicamente — el `messageId` es el del mensaje local.
- Para enviar a un **topic** (en vez de queue), usar el mismo constructor con el nombre del topic; los subscribers reciben por sus subscriptions.
- Requiere cerrar el sender (`close()`) al terminar para liberar la conexión AMQP subyacente.
