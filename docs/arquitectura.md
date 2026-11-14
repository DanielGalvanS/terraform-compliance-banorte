# Arquitectura

Qué hace el sistema, de qué partes se compone y qué garantías sostiene.

## El problema

Hoy el cumplimiento se revisa a mano, tarde en el ciclo y con la evidencia
repartida. Esta plataforma mueve el control a la izquierda —las políticas se
evalúan sobre el plan de Terraform, antes de aplicar— y lo extiende a la
derecha, vigilando el estado real de la nube después.

## Las tres capas

**Entrega.** El repositorio de Git con los módulos y las políticas, el pipeline
de GitHub Actions y el proyecto de GCP donde viven los recursos.

**Control.** El motor de políticas (OPA/Rego con Conftest), el agente de IA y
los sensores que observan la nube.

**Salida.** El registro de evidencia, la aprobación humana y los tickets.

El agente es el único componente que ve las tres capas y coordina el flujo
entre ellas.

## La garantía que lo sostiene todo

> **Las políticas deciden el bloqueo. La IA interpreta y orquesta.**

El veredicto lo emite Conftest de forma determinista: la misma entrada produce
siempre la misma salida, y esa salida se audita sin preguntarle a un modelo por
qué opinó lo que opinó. El agente clasifica hallazgos, los explica y propone
remediaciones como pull requests, pero no puede anular un veredicto ni aplicar
nada en producción.

De ahí se derivan tres reglas:

1. **Falla segura.** Si el evaluador no puede emitir un juicio, se bloquea.
2. **Producción siempre pasa por una persona.** Los revisores viven en el
   environment de GitHub, donde un commit no los puede quitar.
3. **Toda remediación es un cambio de Terraform.** Nunca un cambio en consola.

## El flujo de un cambio

```
pull request
    │
    ├─ validate.yml ──── terraform fmt y validate
    ├─ policies.yml ──── el catálogo se prueba a sí mismo
    │                    y se ejerce contra los planes de ejemplo
    └─ plan.yml ───────── terraform plan real
                              │
                              ├─ conftest sobre el plan
                              ├─ veredicto.json
                              └─ comentario en el pull request
                                      │
                                   ¿conforme?
                                   no → el PR queda bloqueado
                                   sí → se puede mezclar
                                           │
                                      apply.yml (a mano)
                                           │
                        plan ─ compuerta ─ APROBACIÓN HUMANA ─ apply
                                                                 │
                                                        verificación posterior
```

El apply no vuelve a planear: aplica el archivo de plan que pasó la compuerta,
y comprueba su huella SHA-256 antes de hacerlo.

## Lo que hay construido

| Componente | Estado |
| --- | --- |
| Módulos de Terraform (8) | Listos |
| Catálogo de políticas (8 controles) | Listo |
| Pipeline de validación y compuerta | Listo |
| Despliegue con aprobación humana | Listo |
| Ambiente `dev` integrado | Listo |
| Frontend | Listo, con datos de ejemplo |
| API REST | Esqueleto: catálogo y hallazgos, en memoria |
| Agente de IA | Pendiente |
| Detección de drift programada | Pendiente |
| Notificación y aprobación por Slack | Pendiente |
| Escalamiento a tickets de Jira | Pendiente |

La pantalla de aprobaciones muestra «Enviada por Slack» porque dibuja el flujo
que se pretende, igual que el resto del prototipo usa datos de ejemplo. **No
existe ninguna integración**: ni webhook, ni cliente de Slack, ni de Jira. La
aprobación que de verdad bloquea un despliegue vive en el environment de
GitHub.

El reto admite Slack o Teams; el equipo eligió **solo Slack**, para no sostener
dos canales de aviso que haya que mantener sincronizados.

## El mini data center

Lo que `environments/dev` despliega en GCP:

```
Internet
   │
   └── Cloud NAT ──── (solo salida)
            │
   ┌────────┴──────────────── VPC mdc-dev ───────────────────┐
   │                                                          │
   │   subred privada 10.10.1.0/24                            │
   │      ├── vm-mdc-dev-01   sin IP pública, acceso por IAP  │
   │      └── vm-mdc-dev-02   sin IP pública, acceso por IAP  │
   │                                                          │
   │   peering de servicios privados                          │
   │      └── Cloud SQL PostgreSQL   IP privada, CMEK         │
   │                                                          │
   └──────────────────────────────────────────────────────────┘

   KMS: 3 llaves (sql, discos, secretos), rotación de 90 días
   Secret Manager: contenedores replicados solo en la región
   Bucket de evidencia: retención, versionado, sin acceso público
```

Son dos instancias porque las pruebas de red con iperf3 necesitan dos extremos.

## Decisiones

Las que no son obvias están explicadas en [decisiones.md](decisiones.md).
