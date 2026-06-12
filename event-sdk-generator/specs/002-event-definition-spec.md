# Event Definition Spec

Cada evento se define como JSON. El payload usa JSON Schema.

## Campos requeridos

- id
- version
- domain
- name
- description
- payloadSchema

## Ejemplo

```json
{
  "id": "payment.created",
  "version": "1.0.0",
  "domain": "payments",
  "name": "Payment Created",
  "description": "Evento emitido cuando se crea un pago.",
  "payloadSchema": {
    "type": "object",
    "required": ["paymentId", "userId", "amount"],
    "properties": {
      "paymentId": { "type": "string" },
      "userId": { "type": "string" },
      "amount": { "type": "number" }
    }
  }
}
```
