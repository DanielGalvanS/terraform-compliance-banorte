# policies

El catálogo de controles como código. El veredicto de bloqueo se emite **aquí**,
de forma determinista: el agente de IA interpreta y prioriza, pero no puede
anular un bloqueo.

- `rego/` — una política por control, con sus pruebas unitarias. Cada política
  lleva al menos un caso permitido y uno rechazado.
- `fixtures/` — planes de Terraform exportados a JSON para probar las políticas
  sin necesidad de un proyecto de GCP.
- `mappings.yaml` — control → marco regulatorio → política.

## Marcos en alcance

Confirmados con el área de Cumplimiento:

- **CIS Benchmark for GCP** — endurecimiento técnico.
- **LFPDPPP** — datos personales en México.
- **NIST SP 800-53 / SOC 2** — controles de seguridad generales.

La numeración de CIS cambia entre versiones del benchmark, así que `mappings.yaml`
debe fijar la versión exacta contra la que se mapea.
