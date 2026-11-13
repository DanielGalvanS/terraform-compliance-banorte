# modules

Un directorio por módulo. Cada uno expone `main.tf`, `variables.tf`,
`outputs.tf`, `versions.tf` y un `README.md` con ejemplo de uso.

| Módulo    | Estado     | Responsabilidad                                  |
|-----------|------------|--------------------------------------------------|
| `network` | pendiente  | VPC, subred privada, Cloud Router, Cloud NAT     |
| `firewall`| pendiente  | Deny by default; SSH solo desde el rango de IAP  |
| `kms`     | pendiente  | Llaveros y llaves CMEK                           |
| `secrets` | pendiente  | Secret Manager y su control de acceso            |
| `iam`     | pendiente  | Cuentas de servicio de mínimo privilegio         |
| `sql`     | pendiente  | Cloud SQL PostgreSQL: IP privada, CMEK, backups  |
| `compute` | pendiente  | VM de pruebas, sin IP pública, acceso por IAP    |
| `logging` | pendiente  | Sinks de auditoría y retención                   |
