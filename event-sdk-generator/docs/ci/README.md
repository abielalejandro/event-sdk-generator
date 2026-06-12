# CI/CD — Configuración de entornos

El proyecto incluye pipelines equivalentes para **GitHub Actions** y **GitLab CI**. Ambos cubren los mismos flujos: validación, build y publicación a los registros de cada lenguaje.

## Índice

- [Prerequisitos comunes](./prerequisites.md)
- [GitHub Actions](./github-actions.md)
- [GitLab CI](./gitlab-ci.md)

## Resumen de flujos

| Evento | GitHub Actions | GitLab CI |
|--------|---------------|-----------|
| Push a `master` / PR | `ci.yml` — valida + build | `validate:*` + `build:*` |
| Tag `v*.*.*` | `publish-npm.yml` + `publish-maven.yml` + `publish-pypi.yml` | `publish:npm` + `publish:maven` + `publish:pypi` + `release:create` |
| Release manual | `release.yml` (workflow dispatch) | `bump-version` (job manual en master) |

## Registros de publicación

| Lenguaje | Paquete | Registro |
|----------|---------|----------|
| TypeScript | `@eventgen/*` | npmjs.org |
| Java | `com.eventgen:runtime-java` | GitHub Packages / GitLab Packages |
| Python | `eventgen-runtime-python` | PyPI |
