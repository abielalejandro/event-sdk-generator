# Consumer SDK Spec

Tarea para extender los SDKs generados con soporte de consumidores tipados en todos los lenguajes soportados: TypeScript, Java, Python y Go.

Hasta ahora el SDK generado se enfoca en publicar eventos. Esta tarea agrega la contraparte de consumo: handlers tipados por evento, ruteo por `eventId` + `version`, validacion basica del envelope entrante y metadata de consumers declarada en las definiciones JSON.

---

## Objetivos

- Generar APIs de consumo por evento con payloads tipados.
- Reutilizar los tipos de payload ya generados para publishers.
- Exponer un router por SDK que reciba un `EventEnvelope` y ejecute el handler correcto.
- Incluir la lista de `consumers` definida en cada evento como metadata generada.
- Mantener simetria con los publishers: misma estructura por dominio/evento y mismas convenciones de naming por lenguaje.
- Permitir que los adapters de transporte se mantengan agnosticos: el SDK de consumers procesa envelopes, no hace polling de colas ni administra conexiones.

## No objetivos

- No implementar workers completos para SQS, Kafka, Pub/Sub, Service Bus, RabbitMQ, etc.
- No hacer acknowledge, nack, retry o dead-letter desde el SDK generado.
- No reemplazar validacion de payload en runtime con un validador JSON Schema completo.
- No imponer un framework de servidor o worker.

---

## Modelo conceptual

```txt
Transport / Framework -> EventEnvelope -> Generated Consumer Router -> Typed Event Handler
```

Cada runtime debe conservar un tipo neutral `EventEnvelope`. El consumer generado valida que `eventId` y `version` coincidan antes de convertir el payload al tipo esperado.

Clave de ruteo:

```txt
${eventId}@${version}
```

Ejemplo:

```txt
payment.created@1.0.0
```

---

## TypeScript SDK

### Uso esperado

```ts
import { createConsumer } from "@company/generated-events-sdk";

const consumer = createConsumer({
  payments: {
    paymentCreated: async (payload, envelope) => {
      console.log(payload.paymentId, envelope.metadata.traceId);
    }
  }
});

const handled = await consumer.handle(envelope);
```

### Generacion requerida

Por cada evento:

- `Payload` type ya existente.
- `Handler` type:

```ts
export type PaymentsPaymentCreatedHandler = (
  payload: PaymentsPaymentCreatedPayload,
  envelope: EventEnvelope
) => void | Promise<void>;
```

- Factory por evento:

```ts
export function createPaymentsPaymentCreatedConsumer(handler: PaymentsPaymentCreatedHandler) {
  return {
    eventId: "payment.created",
    version: "1.0.0",
    consumers: ["billing-service", "notification-service"] as const,
    async handle(envelope: EventEnvelope): Promise<void> {
      // valida eventId/version y ejecuta handler
    }
  };
}
```

- Router en `index.ts`:

```ts
export function createConsumer(handlers: EventConsumerHandlers) {
  return {
    handle(envelope: EventEnvelope): Promise<boolean>
  };
}
```

---

## Java SDK

### Uso esperado

```java
EventConsumer consumer = EventConsumer.builder()
    .payments()
    .paymentCreated((payload, envelope) -> {
        System.out.println(payload.getPaymentId());
    })
    .build();

boolean handled = consumer.handle(envelope);
```

### Generacion requerida

Por cada evento:

- Payload class ya existente.
- Functional interface por handler:

```java
@FunctionalInterface
public interface PaymentsPaymentCreatedHandler {
    void handle(PaymentsPaymentCreatedPayload payload, EventEnvelope envelope) throws Exception;
}
```

- Consumer class/factory con:
  - `eventId()`
  - `version()`
  - `consumers()`
  - `handle(EventEnvelope envelope)`

- Router `EventConsumer` con builder por dominio/evento.

### Convenciones

- Nombres Java en PascalCase.
- `handle` puede propagar excepciones del handler.
- `EventEnvelope.payload` se castea al payload esperado despues de validar `eventId` y `version`.

---

## Python SDK

### Uso esperado

```python
from company_events import create_consumer

consumer = create_consumer(
    payments={
        "payment_created": handle_payment_created,
    }
)

handled = await consumer.handle(envelope)
```

### Generacion requerida

Por cada evento:

- Dataclass de payload ya existente.
- Type alias o Protocol para handler:

```python
PaymentCreatedHandler = Callable[
    [PaymentsPaymentCreatedPayload, EventEnvelope],
    Awaitable[None] | None,
]
```

- Consumer por evento con:
  - `event_id`
  - `version`
  - `consumers`
  - `handle(envelope)`

- Factory `create_consumer(...)` que construye un router async.

### Convenciones

- Naming snake_case para eventos y argumentos.
- `handle` siempre debe poder esperarse con `await`, aunque el handler sea sync.
- Payloads siguen usando dataclasses y type hints.

---

## Go SDK

### Uso esperado

```go
consumer := events.NewConsumer(events.ConsumerHandlers{
    Payments: &events.PaymentsConsumerHandlers{
        PaymentCreated: func(ctx context.Context, payload payments.PaymentCreatedPayload, envelope runtime.EventEnvelope) error {
            return nil
        },
    },
})

handled, err := consumer.Handle(ctx, envelope)
```

### Generacion requerida

Por cada evento:

- Struct de payload ya existente.
- Handler func type:

```go
type PaymentCreatedHandler func(ctx context.Context, payload PaymentCreatedPayload, envelope runtime.EventEnvelope) error
```

- Consumer por evento con:
  - `EventID() string`
  - `Version() string`
  - `Consumers() []string`
  - `Handle(ctx context.Context, envelope runtime.EventEnvelope) error`

- Router `Consumer` con `Handle(ctx, envelope) (bool, error)`.

### Convenciones

- Go usa `(bool, error)` para distinguir "no route found" de "handler failed".
- El payload se convierte al struct esperado despues de validar `EventID` y `Version`.
- Context se propaga desde el caller.

---

## Cambios por artefacto

| Artefacto | Cambio |
|-----------|--------|
| `packages/generator-typescript` | Generar handlers, consumer factories y `createConsumer` |
| `packages/generator-java` | Generar handler interfaces, consumer classes y router |
| `packages/generator-python` | Generar handler types, consumers async y router |
| `packages/generator-go` | Generar handler funcs, consumers y router |
| `packages/runtime-*` | Asegurar `EventEnvelope` reusable para consumo |
| `README.md` | Documentar ejemplos basicos de consumer por lenguaje |
| `docs/adapters/` | Agregar notas de integracion con transports reales |

---

## Criterios de aceptacion

- `event-sdk generate` genera consumers para todos los targets por defecto.
- `event-sdk generate --target <language>` genera consumers para el target seleccionado.
- Cada lenguaje tiene tests de generator que validan:
  - handler tipado por evento
  - metadata `consumers`
  - router por `eventId@version`
  - comportamiento cuando no existe handler
  - validacion de version/event id incorrectos
- Los tests existentes de publishers siguen pasando.
- La documentacion muestra un ejemplo minimo de consumer por lenguaje.

---

## Orden recomendado

1. TypeScript: menor friccion, ya tiene runtime y tests maduros.
2. Python: API async natural para workers y data pipelines.
3. Go: buena base para servicios backend y workers de alto throughput.
4. Java: completar paridad enterprise con builder y functional interfaces.
