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

## Desarrollo

```bash
npm install          # instala los workspaces
npm run dev          # frontend en http://localhost:5173
npm run build        # typecheck y bundle
```

Terraform y las políticas se trabajan desde `infra/`; consulta su README para
las convenciones obligatorias.

## Marcos en alcance

CIS Benchmark for GCP, LFPDPPP y NIST SP 800-53 / SOC 2.
