# Apache Kafka — KafkaTransportAdapter

Plataforma de streaming distribuido. Alta throughput, retención configurable de mensajes, y soporte para múltiples consumer groups leyendo el mismo topic independientemente.

**Cuándo usarlo:** streaming de eventos de alto volumen, procesamiento en tiempo real, pipelines de datos, casos donde la retención y replay de eventos es importante. Compatible con MSK (AWS), Confluent Cloud, Aiven, Redpanda, etc.

## TypeScript

```ts
import { KafkaTransportAdapter, withLogging } from "@eventgen/runtime-typescript";
import { createClient } from "@company/generated-events-sdk";

const kafkaAdapter = new KafkaTransportAdapter({
  topic: "payments-topic",
  brokers: ["kafka-broker:9092"],
  clientId: "payment-service",    // opcional, default: "eventgen"
});

const transport = withLogging(kafkaAdapter);
const client = createClient(transport);

await client.payments.paymentCreated.publish({
  paymentId: "pay_123",
  userId: "usr_456",
  amount: 100,
  currency: "USD",
});

// Desconectar al finalizar (producción: al apagar el proceso)
await kafkaAdapter.disconnect();
```

### Opciones

| Opción | Tipo | Requerido | Descripción |
|--------|------|-----------|-------------|
| `topic` | `string` | ✅ | Nombre del topic Kafka |
| `brokers` | `string[]` | ✅ | Lista de brokers (`host:port`) |
| `clientId` | `string` | ❌ | ID del cliente. Default: `"eventgen"` |
| `kafka` | `Kafka` | ❌ | Instancia existente de `Kafka` para compartir configuración |

## Java

```java
import com.eventgen.runtime.adapters.KafkaTransportAdapter;
import com.company.events.EventClient;
import java.util.Properties;

Properties kafkaConfig = new Properties();
kafkaConfig.put("bootstrap.servers", "kafka-broker:9092");
// key.serializer y value.serializer se setean automáticamente si no están presentes

try (KafkaTransportAdapter transport = new KafkaTransportAdapter("payments-topic", kafkaConfig)) {
    EventClient client = new EventClient(transport);

    PaymentsCreatedPayload payload = PaymentsCreatedPayload.builder()
        .paymentId("pay_123")
        .userId("usr_456")
        .amount(java.math.BigDecimal.valueOf(100))
        .currency("USD")
        .build();

    PublishResult result = client.payments().paymentCreated().publish(payload);
    System.out.println(result.messageId()); // "0-42" → partition 0, offset 42
}
```

### Constructores

```java
new KafkaTransportAdapter(String topic, Properties producerConfig)
```

## Formato del mensaje Kafka

```
key:   "payment.created"          (eventId)
value: <JSON envelope completo>
headers:
  eventId: "payment.created"
  version: "1.0.0"
  traceId: "550e8400-..."
```

## messageId

El `messageId` retornado tiene el formato `{partition}-{offset}`, por ejemplo `"0-42"`. Esto permite trazar exactamente la posición del mensaje en el log de Kafka.

## Notas

- **Lifecycle:** el producer se conecta en el primer `publish()` (lazy). Llamar a `disconnect()` (TS) o `close()` (Java) al apagar el servicio para hacer flush de mensajes pendientes.
- **Serialization:** key y value usan `StringSerializer`. Para Avro o Protobuf, proveer un `KafkaProducer` pre-configurado.
- **Idempotencia:** para garantías exactly-once, agregar `enable.idempotence=true` en `producerConfig` (Java) o equivalente en el constructor de `Kafka` (TS).
