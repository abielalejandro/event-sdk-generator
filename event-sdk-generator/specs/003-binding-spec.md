# Binding Spec

Los bindings conectan eventos lógicos con destinos físicos por ambiente.

## Providers iniciales

- aws.sqs
- aws.sns

## Providers futuros

- aws.eventbridge
- kafka

## Ejemplo

```json
{
  "environment": "dev",
  "bindings": [
    {
      "eventId": "payment.created",
      "version": "1.0.0",
      "destination": {
        "provider": "aws.sns",
        "topicArnRef": "PAYMENTS_TOPIC_ARN",
        "regionRef": "AWS_REGION"
      }
    }
  ]
}
```
