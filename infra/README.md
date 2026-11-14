# infra

Toda la infraestructura se declara aquí. Ningún recurso se crea desde la consola
de GCP: un recurso que no pasa por un módulo aprobado se marca como no conforme.

- `modules/` — módulos aprobados y versionados (network, firewall, iam, secrets,
  sql, compute, kms, logging). Incluyen los controles por defecto: secure by default.
- `environments/` — composición de módulos por ambiente (dev, qa, prod).
- `policies/` — catálogo de controles como código y su mapeo a marcos.
- `pipelines/` — scripts que ejecuta el CI/CD.
- `evidence/` — plantillas de reportes de cumplimiento.

## Convenciones obligatorias

1. Estado remoto cifrado y con bloqueo por ambiente. Nunca estado local.
2. Versiones fijas de proveedores y módulos; se suben de versión vía pull request.
3. Etiquetas obligatorias en todo recurso etiquetable: `duenio`, `ambiente`,
   `clasificacion_datos`, `centro_costos`, `marco_aplicable` (sin acentos, por
   la restricción de GCP para claves de etiqueta).
4. Secretos solo desde Secret Manager. Nunca en variables ni en el estado.
