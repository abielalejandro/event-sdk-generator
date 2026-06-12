# Generator Spec

El generador debe transformar definiciones JSON en un modelo intermedio neutral al lenguaje y luego producir salidas por target.

```txt
JSON definitions -> NormalizedEventModel -> TypeScript Generator / Java Generator / Catalog Builder
```

## Targets MVP

- typescript
- java
- catalog
