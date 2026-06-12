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

Cada doc de adapter incluye ejemplos en **TypeScript**, **Java**, **Python** y **Go**.

**TypeScript:**
```ts
import { createClient } from "@company/generated-events-sdk";
import { SnsTransportAdapter, withRetry, withLogging } from "@eventgen/runtime-typescript";

const transport = withLogging(withRetry(new SnsTransportAdapter({ topicArn }), { maxAttempts: 3 }));
const client = createClient(transport);
await client.payments.paymentCreated.publish(payload);
```

**Java:**
```java
EventClient client = new EventClient(new SnsTransportAdapter(topicArn));
client.payments().paymentCreated().publish(payload);
```

**Python:**
```python
from eventgen_runtime import SnsTransportAdapter, with_retry, with_logging
from company_events import create_client

transport = with_logging(with_retry(SnsTransportAdapter(topic_arn=topic_arn), max_attempts=3))
client = create_client(transport)
await client.payments.payment_created.publish(payload)
```

**Go:**
```go
sns, _ := adapters.NewSnsTransportAdapter(ctx, topicArn)
transport := middleware.WithLogging(middleware.WithRetry(sns, middleware.RetryOptions{MaxAttempts: 3}), nil)
client := events.NewClient(transport)
result, err := client.Payments().PaymentCreated().Publish(ctx, payload)
```

## Middleware disponible

| Middleware | TypeScript | Java | Python | Go |
|------------|-----------|------|--------|----|
| Retry | `withRetry(adapter, opts)` | manual / futuro | `with_retry(adapter, max_attempts)` | `middleware.WithRetry(adapter, opts)` |
| Logging | `withLogging(adapter, logger?)` | manual / futuro | `with_logging(adapter, logger?)` | `middleware.WithLogging(adapter, logger)` |

## Lifecycle

Los adapters con conexiones persistentes exponen métodos de cierre:

| Adapter | TypeScript | Java | Python | Go |
|---------|-----------|------|--------|----|
| Kafka | `disconnect()` | `close()` / try-with-resources | `disconnect()` | `Close()` |
| RabbitMQ | `close()` | `close()` / try-with-resources | `close()` | `Close()` |
| Pub/Sub | — | `close()` / try-with-resources | — | `Stop()` |
| Service Bus | `close()` | `close()` / try-with-resources | — | `Close(ctx)` |
| AWS adapters | sin estado | sin estado | sin estado | sin estado |
