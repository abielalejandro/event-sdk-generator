# Python & Go SDK Spec

Expansión incremental del generador para soportar Python y Go como targets adicionales. Se agrega un nuevo `generator-python` y un `generator-go` siguiendo el mismo patrón que `generator-typescript` y `generator-java`.

---

## Python SDK

### Uso esperado

```python
from company_events import create_client
from eventgen_runtime import SnsTransportAdapter, with_retry, with_logging

transport = with_logging(with_retry(
    SnsTransportAdapter(topic_arn=os.environ["PAYMENTS_TOPIC_ARN"]),
    max_attempts=3
))

client = create_client(transport)

result = await client.payments.payment_created.publish(
    PaymentsPaymentCreatedPayload(
        payment_id="pay_123",
        user_id="usr_456",
        amount=Decimal("100"),
        currency="USD",
    )
)
```

### Convenciones

- **Naming:** snake_case para métodos y propiedades (`payment_created`, `publish`).
- **Payloads:** dataclasses con type hints. Campos requeridos sin default.
- **Tipos JSON Schema → Python:**
  - `string` → `str`
  - `number` → `Decimal` (`from decimal import Decimal`)
  - `integer` → `int`
  - `boolean` → `bool`
  - `array` → `list`
  - `object` → `dict`
- **Async:** `publish()` es una corrutina (`async def`). Compatible con `asyncio`.
- **Client factory:** función `create_client(transport)` que retorna un objeto con dominios como atributos.

### Estructura generada

```
generated/python/
├── pyproject.toml
├── company_events/
│   ├── __init__.py          # exporta create_client y los payloads
│   ├── runtime.py           # re-exporta desde eventgen-runtime-python
│   └── events/
│       └── payment_created.py
```

### Ejemplo de archivo generado

```python
# events/payment_created.py
from dataclasses import dataclass
from decimal import Decimal
from company_events.runtime import TransportAdapter, PublishResult, build_envelope

@dataclass
class PaymentsPaymentCreatedPayload:
    payment_id: str
    user_id: str
    amount: Decimal
    currency: str

class _PaymentsPaymentCreatedPublisher:
    def __init__(self, transport: TransportAdapter):
        self._transport = transport

    async def publish(
        self,
        payload: PaymentsPaymentCreatedPayload,
        trace_id: str | None = None,
    ) -> PublishResult:
        return await self._transport.publish(
            build_envelope("payment.created", "1.0.0", payload, trace_id)
        )
```

### Runtime Python (`eventgen-runtime-python`)

Paquete pip independiente. Provee:

- `TransportAdapter` (Protocol / ABC)
- `EventEnvelope`, `EventMetadata`, `PublishResult` (dataclasses)
- `build_envelope(event_id, version, payload, trace_id?)` — agrega `created_at` (ISO-8601) y `trace_id` (UUID)
- Adapters: `SnsTransportAdapter`, `SqsTransportAdapter`, `EventBridgeTransportAdapter`, `PubSubTransportAdapter`, `ServiceBusTransportAdapter`, `KafkaTransportAdapter`, `RabbitMQTransportAdapter`, `InMemoryTransportAdapter`
- Middleware: `with_retry(adapter, max_attempts, delay_ms, backoff)`, `with_logging(adapter, logger?)`

---

## Go SDK

### Uso esperado

```go
import (
    "github.com/company/generated-events-sdk/payments"
    "github.com/eventgen/runtime-go/adapters"
)

transport := adapters.NewSnsTransportAdapter(adapters.SnsOptions{
    TopicArn: os.Getenv("PAYMENTS_TOPIC_ARN"),
    Region:   "us-east-1",
})

client := events.NewClient(transport)

result, err := client.Payments().PaymentCreated().Publish(ctx, payments.PaymentCreatedPayload{
    PaymentId: "pay_123",
    UserId:    "usr_456",
    Amount:    decimal.NewFromFloat(100),
    Currency:  "USD",
})
```

### Convenciones

- **Naming:** PascalCase para tipos y métodos exportados (`PaymentCreated`, `Publish`). camelCase para campos de structs JSON (`paymentId`).
- **Payloads:** structs con tags `json:"..."`.
- **Tipos JSON Schema → Go:**
  - `string` → `string`
  - `number` → `decimal.Decimal` (shopspring/decimal)
  - `integer` → `int64`
  - `boolean` → `bool`
  - `array` → `[]interface{}`
  - `object` → `map[string]interface{}`
- **Error handling:** `(Result, error)` — patrón Go estándar.
- **Context:** `Publish(ctx context.Context, payload T)` — propaga contexto para cancelación y tracing.
- **Client factory:** `NewClient(transport TransportAdapter) *Client`.

### Estructura generada

```
generated/go/
├── go.mod
├── client.go            # NewClient y dominios
└── payments/
    └── payment_created.go
```

### Ejemplo de archivo generado

```go
// payments/payment_created.go
package payments

import (
    "context"
    "github.com/eventgen/runtime-go"
)

type PaymentCreatedPayload struct {
    PaymentId string          `json:"paymentId"`
    UserId    string          `json:"userId"`
    Amount    decimal.Decimal `json:"amount"`
    Currency  string          `json:"currency"`
}

type PaymentCreatedPublisher struct {
    transport runtime.TransportAdapter
}

func (p *PaymentCreatedPublisher) Publish(ctx context.Context, payload PaymentCreatedPayload, opts ...runtime.PublishOption) (*runtime.PublishResult, error) {
    envelope := runtime.BuildEnvelope("payment.created", "1.0.0", payload, opts...)
    return p.transport.Publish(ctx, envelope)
}
```

### Runtime Go (`github.com/eventgen/runtime-go`)

Módulo Go independiente. Provee:

- `TransportAdapter` (interface)
- `EventEnvelope`, `EventMetadata`, `PublishResult` (structs)
- `BuildEnvelope(eventId, version, payload, opts...)` — agrega `CreatedAt` y `TraceId`
- Adapters: `SnsTransportAdapter`, `SqsTransportAdapter`, `EventBridgeTransportAdapter`, `PubSubTransportAdapter`, `ServiceBusTransportAdapter`, `KafkaTransportAdapter`, `RabbitMQTransportAdapter`, `InMemoryTransportAdapter`
- Middleware: `WithRetry(adapter, RetryOptions)`, `WithLogging(adapter, Logger)`

---

## Implementación requerida

| Artefacto | Descripción |
|-----------|-------------|
| `packages/generator-python` | Nuevo generador, target `python` en el CLI |
| `packages/generator-go` | Nuevo generador, target `go` en el CLI |
| `packages/runtime-python` | Paquete pip con adapters y middleware |
| `packages/runtime-go` | Módulo Go con adapters y middleware |
| `eventgen.config.json` | Agregar secciones `generate.python` y `generate.go` |
| `docs/adapters/` | Ejemplos Python y Go en cada doc de adapter |

## CLI

```bash
event-sdk generate --target python
event-sdk generate --target go
```

## Prioridad de implementación

1. `generator-python` + `runtime-python` (mayor demanda en data/ML stacks)
2. `generator-go` + `runtime-go` (microservicios de alta performance)
