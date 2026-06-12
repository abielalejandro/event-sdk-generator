# Prerequisitos comunes

Estos pasos son requeridos independientemente de si usás GitHub Actions o GitLab CI.

---

## 1. Cuenta en npm (para publicar TypeScript)

1. Crear cuenta en [npmjs.com](https://www.npmjs.com) si no tenés una.
2. Crear una organización o usar tu username como scope (`@tu-org`).
3. Actualizar el `name` de cada `package.json` en `packages/` con el scope correcto:
   ```json
   { "name": "@tu-org/core" }
   ```
4. Generar un **Access Token** con permisos de publicación:
   - npmjs.com → Avatar → Access Tokens → Generate New Token → **Automation**
   - Guardar el token — se usa como `NPM_TOKEN` en el CI.

---

## 2. Cuenta en PyPI (para publicar Python)

1. Crear cuenta en [pypi.org](https://pypi.org).
2. Registrar el proyecto `eventgen-runtime-python` (o el nombre que hayas elegido).
3. Generar un **API Token** con scope al proyecto:
   - pypi.org → Account settings → API tokens → Add API token
   - Scope: *Project* → `eventgen-runtime-python`
   - Guardar el token — se usa como `PYPI_TOKEN` en el CI.

> **Alternativa (solo GitHub):** configurar Trusted Publishing (OIDC) en PyPI para no necesitar token. Ver [docs/ci/github-actions.md](./github-actions.md#pypi-trusted-publishing).

---

## 3. Java — elegir registro

**Opción A: GitHub Packages** (recomendado si usás GitHub)
- No requiere configuración extra — el pipeline usa `GITHUB_TOKEN` automático.
- Los consumers deben autenticarse con un PAT para bajar el artefacto.

**Opción B: GitLab Package Registry** (recomendado si usás GitLab)
- No requiere configuración extra — el pipeline usa `CI_JOB_TOKEN` automático.

**Opción C: Maven Central**
- Requiere cuenta en [central.sonatype.org](https://central.sonatype.org).
- Requiere firma GPG del artefacto.
- Ver guía oficial: [Publishing to Maven Central](https://central.sonatype.org/publish/publish-guide/).

---

## 4. Estructura de versiones

El campo `version` en los siguientes archivos debe mantenerse sincronizado. Los pipelines hacen el bump automáticamente:

| Archivo | Campo |
|---------|-------|
| `packages/*/package.json` | `"version"` |
| `packages/runtime-python/pyproject.toml` | `version = "..."` |
| `packages/runtime-java/pom.xml` | `<version>...</version>` |

---

## 5. Branch protection

Para que los pipelines funcionen correctamente, configurar `master` como rama protegida:

- **GitHub:** Settings → Branches → Add rule → `master` → Require status checks before merging
- **GitLab:** Settings → Repository → Protected branches → `master` → Allowed to push: Maintainers
