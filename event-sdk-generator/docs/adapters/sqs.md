# AWS SQS — SqsTransportAdapter

Amazon Simple Queue Service. Cola de mensajes durables — un mensaje enviado es consumido por un único worker (punto a punto).

**Cuándo usarlo:** procesamiento asíncrono por un único consumidor, work queues, desacoplamiento de servicios sin fan-out.

## TypeScript

```ts
import { SqsTransportAdapter, withRetry, withLogging } from "@eventgen/runtime-typescript";
import { createClient } from "@company/generated-events-sdk";

const transport = withLogging(
  withRetry(
    new SqsTransportAdapter({
      queueUrl: process.env.PAYMENTS_QUEUE_URL!,
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

console.log(result.messageId); // MessageId de AWS SQS
```

### Opciones

| Opción | Tipo | Requerido | Descripción |
|--------|------|-----------|-------------|
| `queueUrl` | `string` | ✅ | URL completa de la queue SQS |
| `region` | `string` | ❌ | Región AWS. Default: `AWS_REGION` env |
| `client` | `SQSClient` | ❌ | Instancia existente de SQSClient |

## Java

```java
import com.eventgen.runtime.adapters.SqsTransportAdapter;
import com.company.events.EventClient;

SqsTransportAdapter transport = new SqsTransportAdapter(
    System.getenv("PAYMENTS_QUEUE_URL")
);

EventClient client = new EventClient(transport);

PaymentsCreatedPayload payload = PaymentsCreatedPayload.builder()
    .paymentId("pay_123")
    .userId("usr_456")
    .amount(java.math.BigDecimal.valueOf(100))
    .currency("USD")
    .build();

PublishResult result = client.payments().paymentCreated().publish(payload);
```

### Constructores

```java
new SqsTransportAdapter(String queueUrl)
new SqsTransportAdapter(SqsClient client, String queueUrl)
```

## Formato del mensaje enviado a SQS

```json
{
  "MessageBody": "{\"eventId\":\"payment.created\",\"version\":\"1.0.0\",\"payload\":{...},\"metadata\":{...}}",
  "MessageAttributes": {
    "eventId": { "DataType": "String", "StringValue": "payment.created" },
    "version": { "DataType": "String", "StringValue": "1.0.0" }
  }
}
```

## Notas

- El `messageId` retornado es el `MessageId` asignado por SQS.
- Para FIFO queues (`.fifo`), se requiere `MessageGroupId` (extensión futura).
- SQS no hace fan-out — si necesitás múltiples consumidores, combiná con SNS → SQS.

## Python

```python
import os
from eventgen_runtime import SqsTransportAdapter, with_retry, with_logging
from company_events import create_client

transport = with_logging(
    with_retry(
        SqsTransportAdapter(
            queue_url=os.environ["PAYMENTS_QUEUE_URL"],
            region="us-east-1",
        ),
        max_attempts=3,
    )
)

client = create_client(transport)
result = await client.payments.payment_created.publish(payload)
```

### Constructor

```python
SqsTransportAdapter(queue_url: str, region: str | None = None)
```

### Dependencia

```bash
pip install "eventgen-runtime-python[aws]"
```
