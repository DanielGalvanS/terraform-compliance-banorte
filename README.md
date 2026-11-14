# Compliance Ops

Plataforma de validación de cumplimiento regulatorio para infraestructura en
Google Cloud, con Terraform y un agente de IA.

Todo cambio de infraestructura entra por pull request. El pipeline genera el
`terraform plan` en JSON y un motor de políticas lo evalúa contra un catálogo de
controles mapeado a marcos regulatorios. Si hay una violación crítica o alta, el
pull request se bloquea.

## Regla central

**Las políticas deciden el bloqueo; la IA interpreta y orquesta.** El agente
clasifica hallazgos, los explica y propone remediaciones como pull requests de
Terraform, pero no puede anular un veredicto ni aplicar cambios en producción.
Si el agente o el evaluador fallan, el pipeline bloquea y notifica.

## Estructura

```
apps/web/      Frontend (React + TypeScript + Vite)
apps/api/      API REST                        — pendiente
apps/agent/    Agente de IA sobre Vertex AI    — pendiente
infra/         Terraform, políticas y evidencia
docs/          Arquitectura, decisiones y resultados
```

## Estado

| Pieza | Estado |
| --- | --- |
| Módulos de Terraform | 8 de 8 |
| Catálogo de controles | 8, con 32 pruebas unitarias |
| Pipeline de validación y compuerta | Listo |
| Despliegue con aprobación humana | Listo |
| Ambiente `dev` | Integrado |
| Frontend | Listo, con datos de ejemplo |
| API y agente | Pendientes |

Nada se ha ejecutado todavía contra GCP: no hay proyecto. Los módulos están
validados sintácticamente, pero su compatibilidad real con la API de Google
está sin comprobar.

## Desarrollo

```bash
npm install          # instala los workspaces
npm run dev          # frontend en http://localhost:5173
npm run build        # typecheck y bundle
```

Comprobar las políticas sin necesidad de GCP:

```bash
conftest verify --policy infra/policies/rego
infra/pipelines/scripts/policy_check.sh infra/policies/fixtures/plan_conforme.json
```

Terraform y las políticas se trabajan desde `infra/`; consulta su README para
las convenciones obligatorias.

## Documentación

Empieza por [docs/arquitectura.md](docs/arquitectura.md). El índice completo
está en [docs/README.md](docs/README.md).

## Marcos en alcance

CIS Benchmark for GCP, LFPDPPP y NIST SP 800-53 / SOC 2.
