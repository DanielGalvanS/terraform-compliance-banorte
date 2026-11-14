# Módulo `sql`

Cloud SQL PostgreSQL con IP privada, CMEK y respaldos.

## Decisiones

- **Sin IP pública.** `ipv4_enabled = false` y acceso solo por la VPC. Es lo
  que exige CO-DB-01, y la razón de que el módulo `network` tenga que crear
  antes el peering de servicios privados.
- **CMEK obligatoria.** La variable no tiene valor por defecto y valida el
  formato de la ruta. Sin llave propia, el cifrado lo controla Google por
  completo (CO-DB-02).
- **Solo conexiones cifradas.** `ssl_mode = "ENCRYPTED_ONLY"` rechaza quien
  intente conectarse en claro.
- **Recuperación a un punto en el tiempo.** Un respaldo diario deja hasta 24
  horas de pérdida posible; con PITR la ventana se reduce a minutos.
- **Registro de conexiones.** Sin `log_connections` no hay evidencia de quién
  entró a la base.
- **Protección contra borrado, con escape explícito.** Está activa por
  defecto. La prueba de destruir y recrear necesita apagarla, y una
  precondición impide hacerlo en una instancia de producción.

## Uso

```hcl
module "sql" {
  source = "../../modules/sql"

  project_id   = var.project_id
  region       = "us-central1"
  nombre       = "sql-mdc-dev-01"
  red_privada  = module.red.red_id
  llave_kms    = module.kms.llaves["sql"]
  etiquetas    = local.etiquetas_obligatorias
}
```

El orden se declara en la llamada, con `depends_on = [module.red, module.kms]`:
la base no puede crearse antes del peering de servicios privados ni antes de
que el agente de Cloud SQL pueda usar la llave. Terraform acepta un
`depends_on` que apunte a una variable, pero no crea ninguna dependencia real;
por eso el módulo no expone una entrada para eso.

La contraseña del usuario de la base no se declara aquí: vive en Secret
Manager y se carga fuera de Terraform.
