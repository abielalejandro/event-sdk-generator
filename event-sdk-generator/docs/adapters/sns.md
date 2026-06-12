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

## Python

```python
import os
from eventgen_runtime import SnsTransportAdapter, with_retry, with_logging
from company_events import create_client

transport = with_logging(
    with_retry(
        SnsTransportAdapter(
            topic_arn=os.environ["PAYMENTS_TOPIC_ARN"],
            region="us-east-1",        # opcional, default: AWS_REGION env
        ),
        max_attempts=3,
    )
)

client = create_client(transport)

result = await client.payments.payment_created.publish(
    PaymentsPaymentCreatedPayload(
        payment_id="pay_123",
        user_id="usr_456",
        amount=Decimal("100"),
        currency="USD",
    )
)
print(result.message_id)  # MessageId de AWS SNS
```

### Constructor

```python
SnsTransportAdapter(topic_arn: str, region: str | None = None)
```

### Dependencia

```bash
pip install "eventgen-runtime-python[aws]"
```

## Go

```go
import (
    "context"
    "os"

    "github.com/eventgen/runtime-go/adapters"
    "github.com/eventgen/runtime-go/middleware"
    events "github.com/company/generated-events-sdk"
    "github.com/company/generated-events-sdk/payments"
)

ctx := context.Background()

sns, err := adapters.NewSnsTransportAdapter(ctx, os.Getenv("PAYMENTS_TOPIC_ARN"))
if err != nil {
    log.Fatal(err)
}

transport := middleware.WithLogging(
    middleware.WithRetry(sns, middleware.RetryOptions{MaxAttempts: 3}),
    nil, // nil = slog.Default()
)

client := events.NewClient(transport)

result, err := client.Payments().PaymentCreated().Publish(ctx,
    payments.PaymentCreatedPayload{
        PaymentId: "pay_123",
        UserId:    "usr_456",
        Amount:    100.0,
        Currency:  "USD",
    },
)
```

### Constructor

```go
// Con credenciales por defecto (env vars, IAM role, ~/.aws/credentials)
NewSnsTransportAdapter(ctx context.Context, topicArn string, optFns ...func(*config.LoadOptions) error) (*SnsTransportAdapter, error)

// Con cliente SNS pre-configurado
NewSnsTransportAdapterWithClient(client *sns.Client, topicArn string) *SnsTransportAdapter
```

### Dependencia

```bash
go get github.com/eventgen/runtime-go
```
