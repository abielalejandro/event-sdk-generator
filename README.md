# Event SDK Generator Starter

Proyecto inicial para construir, con SDD, un generador de SDKs de eventos async y una web desplegable para consultar eventos definidos.

## Objetivo

A partir de definiciones JSON de eventos, generar:

- Catálogo web desplegable.
- SDK TypeScript.
- SDK Java.
- Validaciones de contratos.
- Publicadores hacia destinos como SQS, SNS, EventBridge y Kafka.

## Requisitos

- Node.js 20+
- pnpm 9+

## Primeros pasos

```bash
pnpm install
pnpm validate
pnpm build:catalog
pnpm dev:web
```

Luego abrir:

```txt
http://localhost:3000
```

## Generar SDKs

```bash
pnpm generate:ts
pnpm generate:java
pnpm generate:python
pnpm generate:go

# Generar todos los SDKs
pnpm generate

# Equivalente desde el CLI
pnpm cli generate
pnpm cli generate --target all
```

Las salidas se crean en:

```txt
generated/typescript
generated/java
generated/python
generated/go
```

## Consumidores

Los SDKs generados incluyen helpers para construir consumidores tipados por evento: handlers, metadata `consumers` y routers por `eventId@version`.

Ver ejemplos por lenguaje en [`docs/consumers.md`](docs/consumers.md).

## Contribuir

El flujo obligatorio de trabajo del proyecto está definido en [`specs/011-contribution-workflow.md`](specs/011-contribution-workflow.md).

Antes de agregar specs, features, fixes o tareas de mantenimiento, seguir esas reglas: partir desde `main`, crear una rama dedicada, mantener un cambio lógico por rama y abrir PR hacia `main`.

Ver el resumen operativo en [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Estructura

```txt
apps/web-catalog              Web para consultar eventos
packages/core                 Parser, validador y modelo común
packages/cli                  CLI validate/build-catalog/generate
packages/generator-typescript Generador SDK TypeScript inicial
packages/generator-java       Generador SDK Java inicial
specs                         Documentos SDD
events                        Definiciones y bindings de ejemplo
```

## Siguiente paso recomendado

Empezar por `specs/001-product-vision.md` y revisar si el alcance del MVP representa tu objetivo.
