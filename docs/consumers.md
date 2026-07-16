# Consumers

Los SDKs generados incluyen helpers para construir consumidores tipados por evento. El SDK no hace polling ni administra conexiones con SQS, Kafka, Pub/Sub, Service Bus, RabbitMQ u otros transports. La aplicacion o framework recibe un `EventEnvelope` y lo entrega al consumer generado.

Flujo esperado:

```txt
Transport / Worker / Framework -> EventEnvelope -> generated consumer -> typed handler
```

La clave de ruteo interna es:

```txt
eventId@version
```

Ejemplo:

```txt
payment.created@1.0.0
```

Si el consumer no tiene handler para el envelope recibido, devuelve `false` en TypeScript, Python y Go. En Java, `EventConsumer.handle(...)` tambien devuelve `false`.

---

## TypeScript

```ts
import { createConsumer, type EventEnvelope } from "@company/generated-events-sdk";

const consumer = createConsumer({
  payments: {
    paymentCreated: async (payload, envelope) => {
      console.log(payload.paymentId, envelope.metadata.traceId);
    }
  }
});

const envelope: EventEnvelope = {
  eventId: "payment.created",
  version: "1.0.0",
  payload: {
    paymentId: "pay_123",
    amount: 100
  },
  metadata: {
    createdAt: new Date().toISOString(),
    traceId: "trace-123"
  }
};

const handled = await consumer.handle(envelope);
```

El handler recibe el payload ya tipado para el evento configurado y el envelope original para metadata como `traceId`.

Si se necesita enrutar manualmente un unico evento, se puede usar el mismo `createConsumer(...)` registrando solo ese handler.

---

## Java

```java
import com.eventgen.runtime.EventEnvelope;
import com.company.events.EventConsumer;

EventConsumer consumer = EventConsumer.builder()
    .payments()
    .paymentCreated((payload, envelope) -> {
        System.out.println(payload.getPaymentId());
    })
    .build();

boolean handled = consumer.handle(envelope);
```

Cada evento genera:

- `PaymentsCreatedHandler`
- `PaymentsCreatedConsumer`
- metadata `eventId()`, `version()` y `consumers()`

Ejemplo con consumer individual:

```java
PaymentsCreatedConsumer paymentCreated = new PaymentsCreatedConsumer((payload, envelope) -> {
    System.out.println(payload.getPaymentId());
});

paymentCreated.handle(envelope);
```

---

## Python

```python
from company_events import create_consumer
from eventgen_runtime import EventEnvelope, EventMetadata

async def handle_payment_created(payload, envelope):
    print(payload.payment_id, envelope.metadata.trace_id)

consumer = create_consumer(
    payments={
        "payment_created": handle_payment_created,
    }
)

envelope = EventEnvelope(
    event_id="payment.created",
    version="1.0.0",
    payload={
        "payment_id": "pay_123",
        "amount": "100",
    },
    metadata=EventMetadata(
        created_at="2026-01-01T00:00:00Z",
        trace_id="trace-123",
    ),
)

handled = await consumer.handle(envelope)
```

El handler puede ser sync o async. El consumer generado siempre expone `async def handle(...)`.

---

## Go

```go
package main

import (
    "context"
    "fmt"

    runtime "github.com/eventgen/runtime-go"
    events "github.com/company/generated-events-sdk"
    "github.com/company/generated-events-sdk/payments"
)

func main() {
    ctx := context.Background()

    consumer := events.NewConsumer(events.ConsumerHandlers{
        Payments: &events.PaymentsConsumerHandlers{
            PaymentCreated: func(ctx context.Context, payload payments.PaymentCreatedPayload, envelope runtime.EventEnvelope) error {
                fmt.Println(payload.PaymentId, envelope.Metadata.TraceID)
                return nil
            },
        },
    })

    handled, err := consumer.Handle(ctx, runtime.EventEnvelope{
        EventID: "payment.created",
        Version: "1.0.0",
        Payload: payments.PaymentCreatedPayload{
            PaymentId: "pay_123",
            Amount: 100,
        },
        Metadata: runtime.EventMetadata{
            TraceID: "trace-123",
        },
    })
    if err != nil {
        panic(err)
    }
    fmt.Println("handled:", handled)
}
```

Go devuelve `(bool, error)` para distinguir entre un envelope sin handler y un handler que fallo.

---

## Integracion con adapters

Los adapters de publicacion existentes implementan `TransportAdapter.publish(...)`. Para consumo, cada integracion debe:

1. Recibir el mensaje desde la plataforma.
2. Decodificar el cuerpo a `EventEnvelope`.
3. Pasar el envelope al consumer generado.
4. Confirmar/reintentar/dead-letter segun las reglas del worker o plataforma.

Ejemplo conceptual:

```txt
SQS message body -> EventEnvelope -> consumer.handle(envelope) -> ack / retry / DLQ
```

Esto mantiene el SDK generado agnostico al transporte y deja las decisiones operativas en el worker.

---

## Ejecutar consumers en background

El runtime tambien puede conectar una fuente de mensajes entrante con el consumer generado.

Flujo:

```txt
MessageSource -> ConsumerRunner -> generated consumer -> typed handler -> ack / retry / DLQ
```

`TransportAdapter` sigue siendo solo para publicar. Para escuchar mensajes se usan `MessageSource` inbound como SQS o Kafka.

### TypeScript

```ts
import { SqsMessageSource, runConsumer } from "@eventgen/runtime-typescript";
import { createConsumer } from "@company/generated-events-sdk";

const consumer = createConsumer({
  payments: {
    paymentCreated: async (payload, envelope) => {
      console.log(payload.paymentId, envelope.metadata.traceId);
    },
  },
});

const runner = runConsumer({
  source: new SqsMessageSource({ queueUrl: process.env.PAYMENTS_QUEUE_URL! }),
  consumer,
  concurrency: 5,
  unhandled: "ack",
});

await runner.start();
```

### Java

```java
EventConsumer consumer = EventConsumer.builder()
    .payments()
    .paymentCreated((payload, envelope) -> {
        System.out.println(payload.getPaymentId());
    })
    .build();

ConsumerRunner runner = ConsumerRunner.builder()
    .source(new SqsMessageSource(queueUrl))
    .consumer(consumer)
    .concurrency(5)
    .build();

runner.start();
```

### Python

```python
consumer = create_consumer(
    payments={
        "payment_created": handle_payment_created,
    }
)

runner = run_consumer(
    source=SqsMessageSource(queue_url),
    consumer=consumer,
    concurrency=5,
    unhandled="ack",
)

await runner.start()
```

### Go

```go
consumer := events.NewConsumer(events.ConsumerHandlers{
    Payments: &events.PaymentsConsumerHandlers{
        PaymentCreated: handlePaymentCreated,
    },
})

source, err := adapters.NewSqsMessageSource(ctx, queueURL)
if err != nil {
    return err
}

runner := runtime.NewConsumerRunner(source, consumer, runtime.ConsumerRunnerOptions{
    Concurrency: 5,
    Unhandled: runtime.MessageActionAck,
})

return runner.Start(ctx)
```

### SNS y EventBridge

SNS y EventBridge no se escuchan directamente desde el runner. Para esos casos se consume desde el destino conectado:

```txt
SNS -> SQS -> SqsMessageSource -> ConsumerRunner
EventBridge -> SQS -> SqsMessageSource -> ConsumerRunner
```
