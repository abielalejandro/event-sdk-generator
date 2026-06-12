# Contribution Workflow Spec

Define el proceso de desarrollo y contribución al proyecto.

## Ramas

- **`master`** es la rama estable. No se commitea directamente sobre ella.
- Toda nueva especificación, feature o fix debe partir de una rama propia creada desde `master`.

## Convención de nombres de rama

```
spec/<nombre-de-la-spec>      # nueva especificación
feat/<nombre-de-la-feature>   # nueva funcionalidad
fix/<descripción-del-fix>     # corrección de bug
chore/<descripción>           # tareas de mantenimiento
```

## Flujo obligatorio para agregar una nueva spec

```bash
# 1. Partir siempre desde master actualizado
git checkout master
git pull origin master

# 2. Crear la rama con el prefijo spec/
git checkout -b spec/<nombre>

# 3. Crear el archivo de spec en specs/
# Numeración correlativa: 012-nombre.md, 013-nombre.md, etc.

# 4. Commitear en la rama
git add specs/<numero>-<nombre>.md
git commit -m "spec: agregar spec <numero> — <descripción>"

# 5. Abrir PR hacia master para revisión
```

## Ejemplo

```bash
git checkout master
git checkout -b spec/retry-policy
# ... crear specs/012-retry-policy.md ...
git add specs/012-retry-policy.md
git commit -m "spec: agregar spec 012 — retry policy avanzado"
```

## Reglas

- Una rama por spec. No agrupar múltiples specs en una sola rama.
- El nombre de la rama debe reflejar el contenido de la spec.
- La rama se mergea a `master` solo después de revisión.
- La numeración de specs es correlativa y no debe reutilizarse.
