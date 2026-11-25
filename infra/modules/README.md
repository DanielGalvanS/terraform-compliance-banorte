# modules

Un directorio por módulo. Cada uno expone `main.tf`, `variables.tf`,
`outputs.tf`, `versions.tf` y un `README.md` con ejemplo de uso.

| Módulo    | Estado     | Responsabilidad                                  |
|-----------|------------|--------------------------------------------------|
| `network` | listo      | VPC, subred privada, Cloud Router, Cloud NAT     |
| `firewall`| listo      | Deny by default; SSH solo desde el rango de IAP  |
| `kms`     | listo      | Llaveros y llaves CMEK                           |
| `secrets` | listo      | Secret Manager y su control de acceso            |
| `iam`     | listo      | Cuentas de servicio de mínimo privilegio         |
| `sql`     | listo      | Cloud SQL PostgreSQL: IP privada, CMEK, backups  |
| `compute` | listo      | VM de pruebas, sin IP pública, acceso por IAP    |
| `logging` | listo      | Sinks de auditoría y retención                   |
| `costos`  | listo      | Presupuesto mensual y avisos de gasto por correo |
| `registro`| listo      | Artifact Registry para las imágenes, con limpieza |
| `cloud_run`| listo     | Un servicio de Cloud Run con su cuenta y acceso  |
