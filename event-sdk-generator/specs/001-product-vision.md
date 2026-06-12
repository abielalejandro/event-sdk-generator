# Product Vision

Construir una herramienta Specification-Driven para definir eventos async una sola vez y generar SDKs tipados para publicarlos desde TypeScript/Node.js y Java.

## Capacidades MVP

- Definir eventos con JSON Schema.
- Separar contrato lógico del binding físico.
- Validar definiciones.
- Generar catálogo web.
- Generar SDK TypeScript.
- Generar SDK Java.
- Soportar inicialmente SQS y SNS.

## Principios

- El evento es independiente del transporte.
- El binding resuelve destino por ambiente.
- El SDK generado contiene código liviano.
- El runtime contiene lógica de transporte, retries, serialización y observabilidad.
