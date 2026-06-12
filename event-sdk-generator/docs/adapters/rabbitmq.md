# RabbitMQ — RabbitMQTransportAdapter

Message broker AMQP de propósito general. Los mensajes se publican en un **exchange** con una **routing key** y RabbitMQ los enruta a las queues que coincidan con los bindings definidos.

**Cuándo usarlo:** arquitecturas on-premise o híbridas, routing flexible por routing key o headers, workflows con acknowledgment explícito, integración con sistemas legados que usan AMQP.

## TypeScript

```ts
import { RabbitMQTransportAdapter, withRetry, withLogging } from "@eventgen/runtime-typescript";
import { createClient } from "@company/generated-events-sdk";

const rabbitAdapter = new RabbitMQTransportAdapter({
  url: "amqp://user:password@rabbitmq-host:5672",
  exchange: "events",
  routingKey: "payment.created",   // opcional, default: envelope.eventId
});

const transport = withLogging(withRetry(rabbitAdapter, { maxAttempts: 3 }));
const client = createClient(transport);

const result = await client.payments.paymentCreated.publish({
  paymentId: "pay_123",
  userId: "usr_456",
  amount: 100,
  currency: "USD",
});

console.log(result.messageId); // UUID generado localmente

// Cerrar al terminar
await rabbitAdapter.close();
```

### Opciones

| Opción | Tipo | Requerido | Descripción |
|--------|------|-----------|-------------|
| `url` | `string` | ✅ | URL de conexión AMQP (`amqp://` o `amqps://`) |
| `exchange` | `string` | ✅ | Nombre del exchange destino |
| `routingKey` | `string` | ❌ | Routing key. Default: `eventId` del evento |

## Java

```java
import com.eventgen.runtime.adapters.RabbitMQTransportAdapter;
import com.company.events.EventClient;

try (RabbitMQTransportAdapter transport = new RabbitMQTransportAdapter(
    "amqp://user:password@rabbitmq-host:5672",
    "events"                           // exchange
    // "payment.created"               // routingKey opcional
)) {
    EventClient client = new EventClient(transport);

    PaymentsCreatedPayload payload = PaymentsCreatedPayload.builder()
        .paymentId("pay_123")
        .userId("usr_456")
        .amount(java.math.BigDecimal.valueOf(100))
        .currency("USD")
        .build();

    PublishResult result = client.payments().paymentCreated().publish(payload);
    System.out.println(result.messageId()); // UUID local
}
```

### Constructores

```java
new RabbitMQTransportAdapter(String url, String exchange)                          // throws Exception
new RabbitMQTransportAdapter(String url, String exchange, String routingKey)       // throws Exception
new RabbitMQTransportAdapter(Connection, Channel, String exchange, String routingKey)  // inyección testing
```

## Formato del mensaje AMQP

```
exchange:    "events"
routingKey:  "payment.created"
body:        <JSON envelope>
properties:
  contentType: "application/json"
  messageId:   "550e8400-e29b-41d4-a716-446655440000"
  headers:
    eventId: "payment.created"
    version: "1.0.0"
    traceId: "550e8400-..."
```

## messageId

RabbitMQ no asigna un ID al publicar — el `messageId` es un UUID generado localmente antes de enviar y se incluye en las propiedades del mensaje AMQP.

## Notas

- **Lifecycle:** la conexión y el channel se crean en el primer `publish()` (lazy). Usar `close()` para liberar recursos al apagar.
- **Exchange pre-existente:** el exchange debe estar declarado en RabbitMQ antes de publicar. El adapter no crea ni declara exchanges.
- **TLS:** usar `amqps://` en la URL para conexiones seguras.
- **Confirmaciones:** el adapter usa publish sin `confirmSelect()` — para publisher confirms (garantía de entrega), se necesita configurar el channel manualmente.

## Python

```python
from eventgen_runtime import RabbitMQTransportAdapter, with_retry, with_logging
from company_events import create_client

rabbit_adapter = RabbitMQTransportAdapter(
    url="amqp://user:password@rabbitmq-host:5672",
    exchange="events",
    routing_key="payment.created",   # opcional, default: event_id
)

transport = with_logging(with_retry(rabbit_adapter, max_attempts=3))
client = create_client(transport)

result = await client.payments.payment_created.publish(payload)

# Cerrar al terminar
await rabbit_adapter.close()
```

### Constructor

```python
RabbitMQTransportAdapter(
    url: str,
    exchange: str,
    routing_key: str | None = None,
)
```

### Dependencia

```bash
pip install "eventgen-runtime-python[rabbitmq]"
```
