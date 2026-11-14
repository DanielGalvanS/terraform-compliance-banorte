# Módulo `secrets`

Contenedores de Secret Manager con replicación acotada a una región.

## El módulo no recibe valores, y es deliberado

`secretos` define el contenedor y quién puede leerlo, pero **nunca el valor**.
No existe una variable para el contenido, y no debe agregarse.

Un valor declarado en Terraform termina en dos sitios de los que ya no se
puede sacar: el estado, en texto plano, y el historial de git. La convención
del reto lo dice sin matices: *secretos solo desde un gestor de secretos, nunca
en variables ni en el estado*.

Las versiones se cargan fuera de Terraform:

```bash
gcloud secrets versions add contrasena-sql --data-file=-
```

o desde el pipeline, con credenciales de corta vida.

## Decisiones

- **Replicación administrada por el usuario.** La automática deja que GCP
  decida dónde vive el dato. Fijar la región mantiene la residencia que piden
  LFPDPPP y las disposiciones de CNBV sobre servicios en nube.
- **CMEK opcional por secreto.** Para que la organización conserve la custodia
  de la llave, igual que en Cloud SQL.
- **Acceso por secreto, no por proyecto.** Quien lee la contraseña de la base
  no debe poder leer las llaves de la API.

## Uso

```hcl
module "secretos" {
  source = "../../modules/secrets"

  project_id = var.project_id
  region     = "us-central1"

  secretos = {
    contrasena-sql = {
      lectores  = ["serviceAccount:${module.iam.cuenta_api}"]
      llave_kms = module.kms.llaves["secretos"]
    }
  }

  etiquetas = local.etiquetas_obligatorias
}
```
