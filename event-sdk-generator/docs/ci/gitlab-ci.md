# GitLab CI — Configuración

Archivos relevantes: `.gitlab-ci.yml`, `.gitlab/maven-settings.xml`

## Jobs incluidos

| Job | Trigger | Qué hace |
|-----|---------|----------|
| `validate:definitions` | MR, push a `master` | Valida eventos y bindings |
| `build:typescript/web/java/python` | MR, push a `master` | Builds paralelos con artifacts |
| `publish:npm` | Tag `v*.*.*` | Publica `@eventgen/*` a npm |
| `publish:maven` | Tag `v*.*.*` | Publica `runtime-java` al GitLab Package Registry |
| `publish:pypi` | Tag `v*.*.*` | Publica `runtime-python` a PyPI |
| `release:create` | Tag `v*.*.*` (tras publish) | Crea GitLab Release |
| `bump-version` | Manual en `master` | Bump de versión + tag (dispara los publish) |

---

## Paso 1 — Configurar variables CI/CD

Ir a: **Settings → CI/CD → Variables → Add variable**

Marcar todas como **Protected** y **Masked**.

| Variable | Valor | Usado en |
|----------|-------|---------|
| `NPM_TOKEN` | Token de npmjs.com (tipo Automation) | `publish:npm` |
| `PYPI_TOKEN` | Token de PyPI (scope al proyecto) | `publish:pypi` |
| `CI_BOT_TOKEN` | Personal Access Token con `write_repository` | `bump-version` |

> `CI_JOB_TOKEN` y `CI_*` variables son inyectadas automáticamente por GitLab — no requieren configuración.

### Crear el CI_BOT_TOKEN

1. Avatar → **Edit profile → Access Tokens**
2. Nombre: `ci-bot`
3. Scopes: `api`, `write_repository`
4. Expiration: según política de seguridad del equipo
5. Guardar el token generado como `CI_BOT_TOKEN` en las variables CI/CD.

---

## Paso 2 — GitLab Package Registry para Maven

El pipeline publica automáticamente al Package Registry del propio proyecto usando `CI_JOB_TOKEN`. No requiere configuración adicional en el pipeline.

Para que otros proyectos puedan consumir el artefacto, deben agregar en `~/.m2/settings.xml`:
```xml
<settings>
  <servers>
    <server>
      <id>gitlab-maven</id>
      <configuration>
        <httpHeaders>
          <property>
            <name>Private-Token</name>
            <value>TU_PERSONAL_ACCESS_TOKEN</value>
          </property>
        </httpHeaders>
      </configuration>
    </server>
  </servers>
</settings>
```

Y en `pom.xml`:
```xml
<repositories>
  <repository>
    <id>gitlab-maven</id>
    <url>https://gitlab.com/api/v4/projects/TU_PROJECT_ID/packages/maven</url>
  </repository>
</repositories>
```

El `TU_PROJECT_ID` se encuentra en: **Settings → General → Project ID**.

---

## Paso 3 — Actualizar nombres de paquete y URLs Maven

Antes del primer release:

```bash
# npm scope
find packages -name "package.json" -exec sed -i 's/@eventgen/@tu-org/g' {} \;

# URL del Package Registry Maven — reemplazar con tu Project ID
# En .gitlab-ci.yml la URL se construye automáticamente con $CI_PROJECT_ID
```

---

## Paso 4 — Configurar branch protection

1. **Settings → Repository → Protected branches**
2. Branch: `master`
3. Allowed to push: `Maintainers`
4. Allowed to merge: `Developers + Maintainers`
5. Activar **Require approval from code owners** (opcional).

---

## Paso 5 — Primer release

El job `bump-version` es **manual** y se ejecuta desde el pipeline de `master`:

1. Ir a **CI/CD → Pipelines → master** (pipeline más reciente)
2. Buscar el job `bump-version` (stage: release)
3. Click en el botón ▶ (play)
4. Cuando pregunte variables, ingresar:
   - `RELEASE_VERSION`: `1.0.0`
5. El job:
   - Actualiza versiones en `package.json`, `pyproject.toml` y `pom.xml`
   - Hace commit en `master`
   - Crea y pushea el tag `v1.0.0`
6. El tag dispara automáticamente `publish:npm`, `publish:maven` y `publish:pypi` en paralelo.
7. Cuando los 3 terminan, `release:create` genera la GitLab Release.

---

## Paso 6 — Verificar publicación

```bash
# npm
npm view @tu-org/runtime-typescript version

# Maven (GitLab Package Registry)
# Ir a: tu-proyecto → Deploy → Package Registry

# PyPI
pip index versions eventgen-runtime-python
```

---

## Troubleshooting

| Error | Causa | Solución |
|-------|-------|----------|
| `403` en npm publish | `NPM_TOKEN` inválido | Regenerar en npmjs.com → Access Tokens |
| `remote: HTTP Basic: Access denied` en `bump-version` | `CI_BOT_TOKEN` sin permisos | Verificar que tenga scope `write_repository` |
| `401 Unauthorized` en Maven deploy | `CI_JOB_TOKEN` expirado o job sin permisos | Verificar que el job no use `needs` de jobs externos |
| `InvalidToken` en PyPI | `PYPI_TOKEN` vencido o scope incorrecto | Regenerar en pypi.org → Account settings → API tokens |
| Pipeline no se dispara con el tag | Branch protection bloquea al bot | Agregar `ci-bot` como usuario con push a tags protegidos |
| `RELEASE_VERSION` vacío en `bump-version` | Variable no ingresada | Agregar la variable cuando GitLab pide confirmación antes de ejecutar el job |

---

## Diferencias vs GitHub Actions

| Aspecto | GitHub Actions | GitLab CI |
|---------|---------------|-----------|
| Maven registry | GitHub Packages | GitLab Package Registry |
| Autenticación Maven | `GITHUB_TOKEN` automático | `CI_JOB_TOKEN` automático |
| PyPI auth | OIDC Trusted Publishing (sin token) | `PYPI_TOKEN` via twine |
| Release manual | workflow_dispatch con inputs | Job manual con variable `RELEASE_VERSION` |
| Release notes | Generadas en GitHub Releases | Generadas en GitLab Releases vía `release-cli` |
