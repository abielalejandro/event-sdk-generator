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

## Python

```python
import os
from eventgen_runtime import ServiceBusTransportAdapter, with_retry, with_logging
from company_events import create_client

transport = with_logging(
    with_retry(
        ServiceBusTransportAdapter(
            connection_string=os.environ["SERVICE_BUS_CONNECTION_STRING"],
            name="payments-queue",
        ),
        max_attempts=3,
    )
)

client = create_client(transport)
result = await client.payments.payment_created.publish(payload)
```

### Constructor

```python
ServiceBusTransportAdapter(connection_string: str, name: str)
```

### Dependencia

```bash
pip install "eventgen-runtime-python[azure]"
```

## Go

```go
import (
    "context"
    "os"

    "github.com/eventgen/runtime-go/adapters"
    "github.com/eventgen/runtime-go/middleware"
    events "github.com/company/generated-events-sdk"
)

ctx := context.Background()

sb, err := adapters.NewServiceBusTransportAdapter(
    os.Getenv("SERVICE_BUS_CONNECTION_STRING"),
    "payments-queue",
)
if err != nil {
    log.Fatal(err)
}
defer sb.Close(ctx)

transport := middleware.WithRetry(sb, middleware.RetryOptions{MaxAttempts: 3})
client := events.NewClient(transport)

result, err := client.Payments().PaymentCreated().Publish(ctx, payload)
```

### Constructor

```go
NewServiceBusTransportAdapter(connectionString, queueOrTopicName string) (*ServiceBusTransportAdapter, error)
NewServiceBusTransportAdapterWithSender(sender *azservicebus.Sender) *ServiceBusTransportAdapter
```

> Llamar `Close(ctx)` al terminar para liberar la conexión AMQP.

### Dependencia

```bash
go get github.com/eventgen/runtime-go
```
