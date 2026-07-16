# Contributing

Este proyecto sigue un flujo de trabajo definido por SDD.

La fuente de verdad para ramas, commits, specs y pull requests es:

- [`specs/011-contribution-workflow.md`](specs/011-contribution-workflow.md)

## Regla principal

Antes de agregar una nueva spec, feature, fix o tarea de mantenimiento:

1. Partir desde `main` actualizado.
2. Crear una rama dedicada con el prefijo correspondiente:
   - `spec/<nombre>`
   - `feat/<nombre>`
   - `fix/<nombre>`
   - `chore/<nombre>`
3. Mantener una rama por cambio lógico.
4. Abrir un PR hacia `main`.
5. Mergear a `main` solo después de revisión.

No se debe commitear directamente en `main`.

Si hay dudas, seguir siempre las reglas completas de la spec 011.
