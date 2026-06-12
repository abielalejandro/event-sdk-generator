# InMemory — InMemoryTransportAdapter

Adapter en memoria para tests unitarios e integración. No envía mensajes a ningún sistema externo — los acumula en un array accesible para hacer assertions.

**Cuándo usarlo:** tests unitarios, tests de integración sin dependencias externas, desarrollo local.

## TypeScript

```ts
import { InMemoryTransportAdapter } from "@eventgen/runtime-typescript";
import { createClient } from "@company/generated-events-sdk";

const transport = new InMemoryTransportAdapter();
const client = createClient(transport);

await client.payments.paymentCreated.publish({
  paymentId: "pay_123",
  userId: "usr_456",
  amount: 100,
  currency: "USD",
});

// Assertions
const [recorded] = transport.published;
console.log(recorded.envelope.eventId);       // "payment.created"
console.log(recorded.envelope.payload);       // { paymentId: "pay_123", ... }
console.log(recorded.publishedAt);            // Date

// Limpiar entre tests
transport.clear();
```

### API

| Método / Propiedad | Tipo | Descripción |
|--------------------|------|-------------|
| `published` | `RecordedEvent[]` | Todos los eventos publicados en orden |
| `clear()` | `void` | Vacía el array de eventos |

Cada `RecordedEvent` tiene:
- `envelope: EventEnvelope` — el envelope completo con metadata
- `publishedAt: Date` — timestamp de cuando fue publicado

## Java

```java
import com.eventgen.runtime.adapters.InMemoryTransportAdapter;
import com.company.events.EventClient;

InMemoryTransportAdapter transport = new InMemoryTransportAdapter();
EventClient client = new EventClient(transport);

PaymentsCreatedPayload payload = PaymentsCreatedPayload.builder()
    .paymentId("pay_123")
    .userId("usr_456")
    .amount(java.math.BigDecimal.valueOf(100))
    .currency("USD")
    .build();

client.payments().paymentCreated().publish(payload);

// Assertions
List<InMemoryTransportAdapter.RecordedEvent> events = transport.getPublished();
assert events.size() == 1;
assert events.get(0).envelope().eventId().equals("payment.created");
assert events.get(0).envelope().payload() != null;

// Limpiar entre tests
transport.clear();
```

### API

| Método | Tipo | Descripción |
|--------|------|-------------|
| `getPublished()` | `List<RecordedEvent>` | Lista inmutable de eventos publicados |
| `clear()` | `void` | Vacía la lista |

Cada `RecordedEvent` (record de Java) tiene:
- `envelope()` — `EventEnvelope` completo
- `publishedAt()` — `Instant` del momento de publicación

## Ejemplo con JUnit 5 (Java)

```java
@Test
void shouldPublishPaymentCreatedEvent() {
    InMemoryTransportAdapter transport = new InMemoryTransportAdapter();
    EventClient client = new EventClient(transport);

    client.payments().paymentCreated().publish(
        PaymentsCreatedPayload.builder()
            .paymentId("pay_123")
            .userId("usr_456")
            .amount(BigDecimal.valueOf(100))
            .currency("USD")
            .build()
    );

    var events = transport.getPublished();
    assertEquals(1, events.size());
    assertEquals("payment.created", events.get(0).envelope().eventId());
}
```

## Notas

- El `messageId` retornado es un UUID generado localmente.
- No hay I/O ni red — los tests son deterministas y rápidos.
- Para tests de middleware (`withRetry`, `withLogging`), combinar con un adapter que falle deliberadamente:
  ```ts
  const failing: TransportAdapter = {
    publish: async () => { throw new Error("timeout"); }
  };
  const transport = withRetry(failing, { maxAttempts: 3, delayMs: 0 });
  ```

## Python

```python
from eventgen_runtime import InMemoryTransportAdapter
from company_events import create_client, PaymentsPaymentCreatedPayload
from decimal import Decimal

transport = InMemoryTransportAdapter()
client = create_client(transport)

await client.payments.payment_created.publish(
    PaymentsPaymentCreatedPayload(
        payment_id="pay_123",
        user_id="usr_456",
        amount=Decimal("100"),
        currency="USD",
    )
)

# Assertions
assert len(transport.published) == 1
event = transport.published[0]
assert event.envelope.event_id == "payment.created"
assert event.envelope.payload["payment_id"] == "pay_123"

# Limpiar entre tests
transport.clear()
```

### API

| Atributo / Método | Tipo | Descripción |
|---|---|---|
| `published` | `list[RecordedEvent]` | Eventos publicados en orden |
| `clear()` | `None` | Vacía la lista |

Cada `RecordedEvent` tiene:
- `envelope: EventEnvelope`
- `published_at: datetime`

### Ejemplo con pytest

```python
import pytest
from eventgen_runtime import InMemoryTransportAdapter
from company_events import create_client, PaymentsPaymentCreatedPayload
from decimal import Decimal

@pytest.mark.asyncio
async def test_publishes_payment_created():
    transport = InMemoryTransportAdapter()
    client = create_client(transport)

    await client.payments.payment_created.publish(
        PaymentsPaymentCreatedPayload(
            payment_id="pay_123",
            user_id="usr_456",
            amount=Decimal("100"),
            currency="USD",
        )
    )

    assert len(transport.published) == 1
    assert transport.published[0].envelope.event_id == "payment.created"
```

### Dependencia

```bash
pip install eventgen-runtime-python   # sin extras, InMemory no tiene dependencias externas
```
