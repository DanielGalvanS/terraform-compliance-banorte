# Módulo `costos`

Presupuesto mensual del proyecto y avisos por correo cuando el gasto se acerca
al límite.

## Un presupuesto avisa, no apaga

GCP **no detiene ningún recurso** al rebasar un presupuesto. Solo manda el
aviso. Lo que realmente corta el gasto es destruir el ambiente al terminar cada
sesión de trabajo (ver [despliegue.md](../../../docs/despliegue.md)). El
presupuesto es la red de seguridad para cuando eso se olvida.

## Decisiones

- **Consumo bruto por defecto.** `descontar_creditos = false` compara el gasto
  antes de aplicar créditos. Con créditos educativos el gasto neto se queda en
  cero hasta que el crédito se agota, y el primer aviso llegaría cuando ya se
  está pagando.
- **Aviso por pronóstico.** Además del 50, 80 y 100 % del gasto real, avisa
  cuando GCP pronostica que el mes cerrará por encima del presupuesto. Es el
  aviso que llega a tiempo para apagar algo.
- **Canales de Cloud Monitoring.** Quien recibe el correo no necesita permisos
  sobre la cuenta de facturación. Los administradores de facturación siguen
  recibiendo el aviso de GCP de siempre.
- **Sin etiquetas.** Ni el presupuesto ni los canales admiten `labels`, por eso
  CO-TAG-01 no los evalúa.

## Permisos necesarios

El presupuesto vive en la **cuenta de facturación**, no en el proyecto. Quien
aplique necesita el rol `roles/billing.costsManager` sobre esa cuenta, y el
proveedor debe facturar la cuota de la API al proyecto:

```hcl
provider "google" {
  project               = var.project_id
  user_project_override = true
  billing_project       = var.project_id
}
```

Sin eso, la API de presupuestos responde `403` aunque los permisos estén bien.

## Uso

```hcl
module "costos" {
  source = "../../modules/costos"

  project_id         = var.project_id
  nombre             = "mdc-dev"
  cuenta_facturacion = var.cuenta_facturacion
  monto_mensual      = 50
  moneda             = "USD"
  correos            = ["equipo@example.com"]
}
```
