# GCP Cloud Pub/Sub — PubSubTransportAdapter

Servicio de mensajería de Google Cloud. Un topic puede tener múltiples subscriptions (push o pull), lo que lo hace equivalente a SNS+SQS combinados.

**Cuándo usarlo:** fan-out de eventos en GCP, integración con Cloud Functions, Cloud Run o Dataflow como consumidores.

## TypeScript

```ts
import { PubSubTransportAdapter, withRetry, withLogging } from "@eventgen/runtime-typescript";
import { createClient } from "@company/generated-events-sdk";

const transport = withLogging(
  withRetry(
    new PubSubTransportAdapter({
      topicName: "payments-topic",
      projectId: "my-gcp-project",   // opcional si GOOGLE_CLOUD_PROJECT está seteado
    }),
    { maxAttempts: 3 }
  )
);

const client = createClient(transport);

const result = await client.payments.paymentCreated.publish({
  paymentId: "pay_123",
  userId: "usr_456",
  amount: 100,
  currency: "USD",
});

console.log(result.messageId); // MessageId de Pub/Sub
```

### Opciones

| Opción | Tipo | Requerido | Descripción |
|--------|------|-----------|-------------|
| `topicName` | `string` | ✅ | Nombre del topic (sin el path completo) |
| `projectId` | `string` | ❌ | GCP project ID. Default: `GOOGLE_CLOUD_PROJECT` env |
| `pubsub` | `PubSub` | ❌ | Instancia existente de PubSub |

## Java

```java
import com.eventgen.runtime.adapters.PubSubTransportAdapter;
import com.company.events.EventClient;

// try-with-resources para cierre correcto del publisher
try (PubSubTransportAdapter transport = new PubSubTransportAdapter("my-gcp-project", "payments-topic")) {
    EventClient client = new EventClient(transport);

    PaymentsCreatedPayload payload = PaymentsCreatedPayload.builder()
        .paymentId("pay_123")
        .userId("usr_456")
        .amount(java.math.BigDecimal.valueOf(100))
        .currency("USD")
        .build();

    PublishResult result = client.payments().paymentCreated().publish(payload);
    System.out.println(result.messageId());
}
```

### Constructores

```java
new PubSubTransportAdapter(String projectId, String topicId)  // throws Exception
new PubSubTransportAdapter(Publisher publisher)                // inyección para testing
```

## Formato del mensaje enviado a Pub/Sub

El cuerpo del mensaje es el envelope JSON en formato UTF-8. Los atributos del mensaje contienen:

```
data: <base64(JSON envelope)>
attributes:
  eventId: "payment.created"
  version: "1.0.0"
  traceId: "550e8400-e29b-41d4-a716-446655440000"
```

## Notas

- Las credenciales GCP se resuelven via Application Default Credentials (ADC): `GOOGLE_APPLICATION_CREDENTIALS` env, `gcloud auth application-default login`, o service account adjunta al recurso.
- En Java, el `Publisher` es asíncrono internamente — `close()` espera hasta 30 segundos para que los mensajes en vuelo se confirmen.
- El `messageId` retornado es el ID asignado por Pub/Sub al mensaje.
