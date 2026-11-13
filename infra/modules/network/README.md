# Módulo `network`

VPC con una subred privada, Cloud Router y Cloud NAT.

## Decisiones

- **Sin subredes automáticas.** `auto_create_subnetworks = false` evita que GCP
  habilite una subred por región sin que nadie lo haya revisado.
- **Acceso privado a Google.** Permite que una VM sin IP pública alcance las
  APIs de Google, que es lo que hace posible cumplir CO-NET-01.
- **Flow logs activos.** Son la evidencia de tráfico que piden los controles de
  monitoreo continuo de NIST y CIS.
- **NAT con logging de errores.** Da salida a instancias privadas sin exponerlas.

## Sobre las etiquetas obligatorias

Este módulo no recibe `labels`. Las redes, subredes, routers y gateways NAT de
GCP **no admiten etiquetas**: la API no expone el campo. La convención de las
cinco etiquetas aplica a los recursos que sí son etiquetables (instancias,
discos, instancias de Cloud SQL, buckets, llaves de KMS y secretos), y la
política CO-TAG-01 evalúa únicamente esos tipos.

## Uso

```hcl
module "red" {
  source = "../../modules/network"

  project_id  = var.project_id
  region      = "us-central1"
  nombre      = "mdc-dev"
  subred_cidr = "10.10.1.0/24"
}
```
