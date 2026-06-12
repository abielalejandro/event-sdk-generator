# AWS SNS — SnsTransportAdapter

Amazon Simple Notification Service. Modelo pub/sub serverless — un mensaje publicado en un topic se entrega a todos sus subscribers (SQS, Lambda, HTTP, email, etc.).

**Cuándo usarlo:** fan-out de eventos a múltiples consumidores, notificaciones cross-service, arquitecturas event-driven en AWS.

## TypeScript

```ts
import { SnsTransportAdapter, withRetry, withLogging } from "@eventgen/runtime-typescript";
import { createClient } from "@company/generated-events-sdk";

const transport = withLogging(
  withRetry(
    new SnsTransportAdapter({
      topicArn: process.env.PAYMENTS_TOPIC_ARN!,
      region: "us-east-1",          // opcional, default: AWS_REGION env
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

console.log(result.messageId); // MessageId de AWS SNS
```

### Opciones

| Opción | Tipo | Requerido | Descripción |
|--------|------|-----------|-------------|
| `topicArn` | `string` | ✅ | ARN del topic SNS destino |
| `region` | `string` | ❌ | Región AWS. Default: `AWS_REGION` env |
| `client` | `SNSClient` | ❌ | Instancia existente de SNSClient (útil para testing) |

## Java

```java
import com.eventgen.runtime.adapters.SnsTransportAdapter;
import com.company.events.EventClient;

SnsTransportAdapter transport = new SnsTransportAdapter(
    System.getenv("PAYMENTS_TOPIC_ARN")
);

EventClient client = new EventClient(transport);

PaymentsCreatedPayload payload = PaymentsCreatedPayload.builder()
    .paymentId("pay_123")
    .userId("usr_456")
    .amount(java.math.BigDecimal.valueOf(100))
    .currency("USD")
    .build();

PublishResult result = client.payments().paymentCreated().publish(payload);
System.out.println(result.messageId());
```

### Constructores

```java
// Crea SNSClient automáticamente con credenciales del entorno
new SnsTransportAdapter(String topicArn)

// Inyecta un SNSClient existente (testing, configuración custom)
new SnsTransportAdapter(SnsClient client, String topicArn)
```

## Formato del mensaje enviado a SNS

```json
{
  "Message": "{\"eventId\":\"payment.created\",\"version\":\"1.0.0\",\"payload\":{...},\"metadata\":{...}}",
  "MessageAttributes": {
    "eventId": { "DataType": "String", "StringValue": "payment.created" },
    "version": { "DataType": "String", "StringValue": "1.0.0" }
  }
}
```

## Notas

- Las credenciales AWS se resuelven automáticamente vía la Default Credential Chain (env vars, IAM role, ~/.aws/credentials).
- El `messageId` retornado es el `MessageId` asignado por SNS.
- Para FIFO topics, usar la versión con `MessageGroupId` (extensión futura).
