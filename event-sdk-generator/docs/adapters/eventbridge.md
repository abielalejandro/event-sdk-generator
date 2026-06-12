# AWS EventBridge — EventBridgeTransportAdapter

Bus de eventos serverless de AWS. Enruta eventos a múltiples targets (Lambda, SQS, Step Functions, etc.) mediante reglas con filtros declarativos.

**Cuándo usarlo:** event routing complejo con filtros por contenido, integración con servicios AWS nativos, arquitecturas event-driven con múltiples consumidores heterogéneos.

## TypeScript

```ts
import { EventBridgeTransportAdapter, withLogging } from "@eventgen/runtime-typescript";
import { createClient } from "@company/generated-events-sdk";

const transport = withLogging(
  new EventBridgeTransportAdapter({
    eventBusName: "payments-bus",
    source: "payment-service",    // opcional, default: eventId ("payment.created")
    region: "us-east-1",
  })
);

const client = createClient(transport);

const result = await client.payments.paymentCreated.publish({
  paymentId: "pay_123",
  userId: "usr_456",
  amount: 100,
  currency: "USD",
});

console.log(result.messageId); // EventId de AWS EventBridge
```

### Opciones

| Opción | Tipo | Requerido | Descripción |
|--------|------|-----------|-------------|
| `eventBusName` | `string` | ✅ | Nombre del event bus (o ARN) |
| `source` | `string` | ❌ | Campo `Source` del evento. Default: `eventId` |
| `region` | `string` | ❌ | Región AWS. Default: `AWS_REGION` env |
| `client` | `EventBridgeClient` | ❌ | Instancia existente |

## Java

```java
import com.eventgen.runtime.adapters.EventBridgeTransportAdapter;
import com.company.events.EventClient;

// Sin source explícito — usa eventId como source
EventBridgeTransportAdapter transport = new EventBridgeTransportAdapter("payments-bus");

// Con source explícito
EventBridgeTransportAdapter transport = new EventBridgeTransportAdapter(
    "payments-bus",
    "payment-service"
);

EventClient client = new EventClient(transport);
client.payments().paymentCreated().publish(payload);
```

### Constructores

```java
new EventBridgeTransportAdapter(String eventBusName)
new EventBridgeTransportAdapter(String eventBusName, String source)
new EventBridgeTransportAdapter(EventBridgeClient client, String eventBusName, String source)
```

## Formato del evento enviado a EventBridge

```json
{
  "EventBusName": "payments-bus",
  "Source": "payment-service",
  "DetailType": "payment.created",
  "Detail": "{\"eventId\":\"payment.created\",\"version\":\"1.0.0\",\"payload\":{...},\"metadata\":{...}}",
  "Time": "2026-06-12T03:00:00Z"
}
```

## Notas

- Si `FailedEntryCount > 0` en la respuesta de AWS, el adapter lanza excepción con `ErrorCode` y `ErrorMessage`.
- El campo `DetailType` siempre es el `eventId` del evento (ej: `"payment.created"`).
- Útil para crear reglas de filtrado en EventBridge por `DetailType` o contenido del `Detail`.

## Python

```python
import os
from eventgen_runtime import EventBridgeTransportAdapter, with_logging
from company_events import create_client

transport = with_logging(
    EventBridgeTransportAdapter(
        event_bus_name="payments-bus",
        source="payment-service",      # opcional, default: event_id
        region="us-east-1",
    )
)

client = create_client(transport)
result = await client.payments.payment_created.publish(payload)
```

### Constructor

```python
EventBridgeTransportAdapter(
    event_bus_name: str,
    source: str | None = None,
    region: str | None = None,
)
```

### Dependencia

```bash
pip install "eventgen-runtime-python[aws]"
```
