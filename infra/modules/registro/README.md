# Módulo `registro`

Repositorio de Artifact Registry para las imágenes de contenedor de la
plataforma. Uno solo para todas las aplicaciones.

## Decisiones

- **Etiquetas inmutables.** Una etiqueta (el commit, por ejemplo) siempre
  apunta a la misma imagen: lo que se aprobó es lo que se despliega.
- **Las imágenes viejas se borran solas.** Se conservan las
  `versiones_a_conservar` más recientes de cada aplicación (5 por defecto) y se
  borra lo que pase de 30 días. Cada despliegue sube una imagen nueva, y el
  almacenamiento cobra. Las reglas se aplican de verdad
  (`cleanup_policy_dry_run = false`).
- **Misma región que Cloud Run.** Las imágenes no cruzan regiones al
  desplegar.

## Uso

```hcl
module "registro" {
  source = "../../modules/registro"

  project_id = var.project_id
  region     = var.region
  nombre     = "contenedores"
  etiquetas  = local.etiquetas
}
```

`url` devuelve el prefijo de las imágenes:
`<region>-docker.pkg.dev/<proyecto>/contenedores`.

## Pruebas

```bash
terraform -chdir=infra/modules/registro init -backend=false
terraform -chdir=infra/modules/registro test
```
