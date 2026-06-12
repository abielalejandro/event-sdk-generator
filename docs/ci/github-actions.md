# GitHub Actions — Configuración

Archivos relevantes: `.github/workflows/`

## Workflows incluidos

| Archivo | Trigger | Qué hace |
|---------|---------|----------|
| `ci.yml` | Push a `master`, PR a `master` | Valida, buildea todos los paquetes y el web catalog |
| `publish-npm.yml` | Push de tag `v*.*.*` | Publica paquetes TypeScript a npm |
| `publish-maven.yml` | Push de tag `v*.*.*` | Publica `runtime-java` a GitHub Packages |
| `publish-pypi.yml` | Push de tag `v*.*.*` | Publica `runtime-python` a PyPI |
| `release.yml` | Manual (workflow dispatch) | Bump de versión + creación del tag |

---

## Paso 1 — Configurar Secrets

Ir a: **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Valor | Cuándo se usa |
|--------|-------|--------------|
| `NPM_TOKEN` | Token de npmjs.com (tipo Automation) | `publish-npm.yml` |

> `GITHUB_TOKEN` es inyectado automáticamente por GitHub — no requiere configuración.

---

## Paso 2 — PyPI Trusted Publishing (sin token)

Este método elimina la necesidad de guardar `PYPI_TOKEN` como secret.

1. Ir a [pypi.org](https://pypi.org) → tu proyecto → **Manage** → **Publishing**
2. Agregar un nuevo publisher:
   - Publisher: **GitHub Actions**
   - Owner: `tu-usuario-o-org`
   - Repository: `event-sdk-generator`
   - Workflow name: `publish-pypi.yml`
   - Environment name: *(dejar vacío)*
3. El workflow ya está configurado con `id-token: write` y usa `pypa/gh-action-pypi-publish`.

Si preferís usar token directo, agregar el secret `PYPI_TOKEN` y modificar `publish-pypi.yml`:
```yaml
- name: Publish to PyPI
  uses: pypa/gh-action-pypi-publish@release/v1
  with:
    packages-dir: packages/runtime-python/dist/
    password: ${{ secrets.PYPI_TOKEN }}
```

---

## Paso 3 — GitHub Packages para Maven

El workflow `publish-maven.yml` usa `GITHUB_TOKEN` automático para publicar al Package Registry de tu repo. No requiere configuración adicional.

Para que otros proyectos puedan consumir el artefacto Maven, deben agregar en su `~/.m2/settings.xml`:
```xml
<servers>
  <server>
    <id>github</id>
    <username>GITHUB_USERNAME</username>
    <password>PERSONAL_ACCESS_TOKEN</password>  <!-- scope: read:packages -->
  </server>
</servers>
```

Y en su `pom.xml`:
```xml
<repositories>
  <repository>
    <id>github</id>
    <url>https://maven.pkg.github.com/TU_ORG/event-sdk-generator</url>
  </repository>
</repositories>
```

---

## Paso 4 — Actualizar nombres de paquete

Antes del primer release, actualizar los nombres en los `package.json` con tu scope de npm:

```bash
# Reemplazar @eventgen por @tu-org en todos los package.json
find packages -name "package.json" -exec sed -i 's/@eventgen/@tu-org/g' {} \;
```

---

## Paso 5 — Primer release

1. Ir a **Actions → Release → Run workflow**
2. Completar el campo `version`: `1.0.0`
3. El workflow:
   - Actualiza los `version` en `package.json`, `pyproject.toml` y `pom.xml`
   - Hace commit en `master`
   - Crea y pushea el tag `v1.0.0`
4. El tag dispara automáticamente `publish-npm.yml`, `publish-maven.yml` y `publish-pypi.yml` en paralelo.

---

## Verificar publicación

```bash
# npm
npm view @tu-org/runtime-typescript version

# Maven (GitHub Packages)
# Verificar en: https://github.com/TU_ORG/event-sdk-generator/packages

# PyPI
pip index versions eventgen-runtime-python
```

---

## Troubleshooting

| Error | Causa | Solución |
|-------|-------|----------|
| `403 Forbidden` en npm | `NPM_TOKEN` inválido o expirado | Regenerar en npmjs.com → Access Tokens |
| `403 Forbidden` en GitHub Packages | `GITHUB_TOKEN` sin permisos `packages: write` | Verificar que el workflow tenga `permissions: packages: write` |
| `InvalidToken` en PyPI | Token vencido o scope incorrecto | Regenerar en pypi.org → Account settings → API tokens |
| `Resource not accessible by integration` | Branch protection bloquea el push del tag | Agregar excepción para `github-actions[bot]` |
