# Transport Adapters

Los adapters implementan la interfaz `TransportAdapter` y encapsulan la lógica de publicación para cada plataforma de mensajería. El SDK generado es agnóstico al transporte — se configura al crear el client.

## Adapters disponibles

| Adapter | Plataforma | Archivo |
|---------|-----------|---------|
| `SnsTransportAdapter` | AWS SNS | [sns.md](./sns.md) |
| `SqsTransportAdapter` | AWS SQS | [sqs.md](./sqs.md) |
| `EventBridgeTransportAdapter` | AWS EventBridge | [eventbridge.md](./eventbridge.md) |
| `PubSubTransportAdapter` | GCP Cloud Pub/Sub | [pubsub.md](./pubsub.md) |
| `ServiceBusTransportAdapter` | Azure Service Bus | [servicebus.md](./servicebus.md) |
| `KafkaTransportAdapter` | Apache Kafka | [kafka.md](./kafka.md) |
| `RabbitMQTransportAdapter` | RabbitMQ (AMQP) | [rabbitmq.md](./rabbitmq.md) |
| `InMemoryTransportAdapter` | Testing | [memory.md](./memory.md) |

## Patrón de uso común

```ts
import { createClient } from "@company/generated-events-sdk";
import { <Adapter>, withRetry, withLogging } from "@eventgen/runtime-typescript";

const transport = withLogging(
  withRetry(new <Adapter>({ /* opciones */ }), { maxAttempts: 3 })
);

const client = createClient(transport);

await client.<domain>.<event>.publish({ /* payload */ });
```

## Middleware disponible

| Middleware | Descripción |
|------------|-------------|
| `withRetry(adapter, options)` | Reintentos con backoff fijo o exponencial |
| `withLogging(adapter, logger?)` | Logs de inicio, éxito y error con duración |

Los middlewares son componibles y se aplican en cadena.

## Lifecycle

Los adapters con conexiones persistentes exponen `close()` / `disconnect()`:

| Adapter | TypeScript | Java |
|---------|-----------|------|
| Kafka | `await adapter.disconnect()` | `adapter.close()` / `try-with-resources` |
| RabbitMQ | `await adapter.close()` | `adapter.close()` / `try-with-resources` |
| Pub/Sub | — | `adapter.close()` / `try-with-resources` |
| Service Bus | `await adapter.close()` | `adapter.close()` / `try-with-resources` |
| AWS adapters | sin estado | sin estado |
