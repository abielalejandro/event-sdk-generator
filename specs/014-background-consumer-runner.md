# Background Consumer Runner Spec

**Estado:** Finalizada  
**Finalizada el:** 2026-07-17

Define el soporte para ejecutar consumers en background sobre fuentes de mensajes como SQS, Kafka, RabbitMQ, Pub/Sub y Service Bus.

## Contexto

El SDK ya soporta:

- publicar eventos con `TransportAdapter.publish(...)`;
- generar consumers tipados por evento;
- rutear `EventEnvelope` por `eventId@version`;
- ejecutar handlers tipados por lenguaje.

Lo que falta es una capa runtime que conecte un transporte entrante con el consumer generado y mantenga un proceso escuchando mensajes.

## Objetivos

- Agregar una abstraccion inbound separada de `TransportAdapter`.
- Permitir ejecutar un consumer generado en background.
- Encapsular polling, subscription, ack, retry y dead-letter por transporte.
- Mantener los consumers generados agnosticos del transporte.
- Permitir shutdown limpio.
- Soportar concurrencia configurable.
- Proveer fuentes in-memory para tests.
- Documentar ejemplos por lenguaje.

## No objetivos

- No mezclar publicacion y consumo en la misma interfaz `TransportAdapter`.
- No agregar polling dentro del SDK generado.
- No imponer un worker framework especifico.
- No implementar SNS/EventBridge como fuentes directas de consumo.
- No reemplazar las politicas nativas de retry/dead-letter de cada plataforma.

## Modelo conceptual

```txt
SQS/Kafka/RabbitMQ/PubSub/ServiceBus
        -> MessageSource
        -> ConsumerRunner
        -> Generated Consumer
        -> Typed Handler
        -> ack / retry / dead-letter
```

La responsabilidad queda dividida asi:

- `MessageSource`: recibe mensajes desde una plataforma.
- `ReceivedMessage`: representa un mensaje recibido y sus operaciones de confirmacion.
- `ConsumerRunner`: ejecuta el loop, controla concurrencia y entrega envelopes al consumer generado.
- `Generated Consumer`: enruta el `EventEnvelope` al handler tipado correcto.

## Interfaces comunes

### MessageSource

Representa una fuente de mensajes entrantes.

Debe poder:

- recibir uno o mas mensajes;
- decodificar el cuerpo a `EventEnvelope`;
- exponer el mensaje original para observabilidad/debug;
- cerrar conexiones si aplica.

Ejemplo conceptual:

```ts
interface MessageSource {
  receive(options?: ReceiveOptions): Promise<ReceivedMessage[]>;
  close?(): Promise<void>;
}
```

### ReceivedMessage

Representa un mensaje recibido desde un transporte.

```ts
type ReceivedMessage = {
  envelope: EventEnvelope;
  raw: unknown;
  attributes?: Record<string, unknown>;
  ack(): Promise<void>;
  retry(error?: unknown): Promise<void>;
  deadLetter?(error?: unknown): Promise<void>;
};
```

Semantica esperada:

- `ack`: confirma procesamiento exitoso.
- `retry`: libera o reintenta el mensaje segun el transporte.
- `deadLetter`: envia a DLQ cuando el transporte lo permite.

### ConsumerRunner

Ejecuta un consumer generado contra una fuente de mensajes.

Debe encargarse de:

- loop de background;
- concurrencia;
- backoff cuando no hay mensajes;
- manejo de errores;
- accion para mensajes no manejados;
- shutdown limpio;
- observabilidad basica.

Opciones esperadas:

```ts
type ConsumerRunnerOptions = {
  source: MessageSource;
  consumer: { handle(envelope: EventEnvelope): Promise<boolean> };
  concurrency?: number;
  idleDelayMs?: number;
  unhandled?: "ack" | "retry" | "deadLetter" | "ignore";
  onError?: (error: unknown, message?: ReceivedMessage) => void | Promise<void>;
};
```

## Semantica de procesamiento

Para cada mensaje:

1. `MessageSource` recibe y decodifica el mensaje a `EventEnvelope`.
2. `ConsumerRunner` llama `consumer.handle(envelope)`.
3. Si `handle(...)` devuelve `true`, se ejecuta `ack()`.
4. Si `handle(...)` devuelve `false`, se aplica la politica `unhandled`.
5. Si el handler falla, se ejecuta `retry(...)` o `deadLetter(...)` segun configuracion.
6. El runner sigue procesando hasta recibir `stop()` o cancelacion del contexto.

Politica recomendada por defecto:

- `unhandled: "ack"` para evitar loops infinitos con eventos desconocidos.
- errores de handler: `retry` cuando el transporte lo soporta.

## Transports inbound esperados

### InMemoryMessageSource

Para tests y ejemplos locales.

- Entrega envelopes en memoria.
- `ack` remueve el mensaje.
- `retry` puede reencolar el mensaje.

### SqsMessageSource

Consume desde SQS.

- Usa long polling.
- `ack` ejecuta `DeleteMessage`.
- `retry` no borra el mensaje y deja que venza visibility timeout.
- `deadLetter` puede delegarse a redrive policy de SQS o implementar envio explicito si se configura una DLQ.

### KafkaMessageSource

Consume desde Kafka.

- Usa consumer group.
- `ack` commitea offset despues del procesamiento exitoso.
- `retry` no commitea offset o aplica estrategia configurada.
- `deadLetter` publica a un topic DLQ si se configura.

### RabbitMQMessageSource

Consume desde una queue.

- `ack` confirma el delivery.
- `retry` usa `nack` con requeue segun configuracion.
- `deadLetter` usa exchange/queue DLQ configurado en RabbitMQ.

### PubSubMessageSource

Consume desde Google Pub/Sub subscription.

- `ack` confirma el mensaje.
- `retry` ejecuta `nack`.
- `deadLetter` se delega a dead-letter policy de Pub/Sub.

### ServiceBusMessageSource

Consume desde Azure Service Bus queue/subscription.

- `ack` completa el mensaje.
- `retry` abandona el mensaje.
- `deadLetter` usa la operacion nativa de dead-letter.

### SNS y EventBridge

SNS y EventBridge no deben implementarse como fuentes directas de consumo en esta fase.

Para consumir eventos publicados en SNS o EventBridge se debe usar el destino conectado:

- SNS -> SQS -> `SqsMessageSource`
- SNS -> HTTP/Lambda -> adapter/framework externo
- EventBridge -> SQS -> `SqsMessageSource`
- EventBridge -> Lambda -> adapter/framework externo

## TypeScript API esperada

```ts
import { SqsMessageSource, runConsumer } from "@eventgen/runtime";
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
  onError: async (error, message) => {
    console.error(error, message?.envelope.eventId);
  },
});

await runner.start();

process.on("SIGTERM", async () => {
  await runner.stop();
});
```

## Java API esperada

```java
EventConsumer consumer = EventConsumer.builder()
    .payments()
    .paymentCreated((payload, envelope) -> {
        System.out.println(payload.getPaymentId());
    })
    .build();

MessageSource source = new SqsMessageSource(queueUrl);

ConsumerRunner runner = ConsumerRunner.builder()
    .source(source)
    .consumer(consumer)
    .concurrency(5)
    .unhandledPolicy(UnhandledPolicy.ACK)
    .build();

runner.start();
```

## Python API esperada

```python
from company_events import create_consumer
from eventgen_runtime import SqsMessageSource, run_consumer

consumer = create_consumer(
    payments={
        "payment_created": handle_payment_created,
    }
)

runner = run_consumer(
    source=SqsMessageSource(queue_url=queue_url),
    consumer=consumer,
    concurrency=5,
    unhandled="ack",
)

await runner.start()
```

## Go API esperada

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
    Unhandled: runtime.UnhandledAck,
})

return runner.Start(ctx)
```

## Cambios por paquete

| Paquete | Cambio |
| --- | --- |
| `packages/runtime-typescript` | Agregar `MessageSource`, `ReceivedMessage`, `ConsumerRunner`, `runConsumer`, `InMemoryMessageSource`, `SqsMessageSource`, `KafkaMessageSource` |
| `packages/runtime-java` | Agregar interfaces inbound, runner, in-memory, SQS y Kafka |
| `packages/runtime-python` | Agregar protocolos inbound, runner async, in-memory, SQS y Kafka |
| `packages/runtime-go` | Agregar interfaces inbound, runner con `context.Context`, in-memory, SQS y Kafka |
| `docs/consumers.md` | Agregar seccion de background runners |
| `apps/web-catalog` | Mostrar ejemplos de consume en background por lenguaje |

## Orden recomendado de implementacion

1. Implementar TypeScript runtime.
2. Agregar `InMemoryMessageSource` y tests de runner.
3. Agregar `SqsMessageSource`.
4. Agregar `KafkaMessageSource`.
5. Documentar TypeScript.
6. Replicar el patron en Python.
7. Replicar el patron en Go.
8. Replicar el patron en Java.
9. Actualizar web catalog con ejemplos `Run in background`.

## Criterios de aceptacion

- Existe una interfaz inbound separada de `TransportAdapter`.
- El runner puede ejecutar un consumer generado en background.
- El runner soporta stop/shutdown limpio.
- El runner soporta concurrencia configurable.
- Los mensajes procesados correctamente ejecutan `ack`.
- Los errores de handler ejecutan la politica de retry/dead-letter configurada.
- Los eventos sin handler aplican la politica `unhandled`.
- SQS y Kafka tienen al menos una implementacion inicial.
- Existe una fuente in-memory para tests.
- Los consumers generados no contienen logica de polling ni conexiones de transporte.
- La documentacion muestra como ejecutar un consumer en background.
