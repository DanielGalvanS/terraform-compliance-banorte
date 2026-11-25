# Módulo `logging`

Registros de auditoría con destino inmutable.

## El bloqueo de retención es irreversible

`bloquear_retencion` deja la política del bucket **sin vuelta atrás**: ni se
acorta, ni se quita, ni se borra el bucket hasta que venza el plazo de cada
objeto. Eso es justo lo que hace que la evidencia sirva ante un auditor, y
también lo que convierte un error en algo permanente.

Por eso el valor por defecto es `false`. En dev y qa bloquearlo solo estorba.
Se activa en producción, **cuando Cumplimiento haya confirmado el plazo** según
el marco más estricto aplicable. No antes.

## Decisiones

- **Append-only por retención, no por permisos.** Aunque alguien obtuviera
  acceso de escritura, no podría borrar un objeto antes de su plazo.
- **Auditoría de acceso a datos activa.** Sin `DATA_READ` quedan registradas
  las operaciones de administración pero no quién consultó qué. Multiplica el
  volumen, así que es una variable.
- **Identidad propia del sink.** `unique_writer_identity` crea una cuenta solo
  para este sink, en vez de reutilizar una compartida.
- **Sin acceso público ni ACL por objeto.** El acceso se decide con IAM, que es
  lo que queda registrado.
- **La API solo puede crear y leer.** `escritores` recibe
  `roles/storage.objectCreator`, que crea objetos pero no los borra; sin
  borrar tampoco se puede sobrescribir. `lectores` recibe
  `roles/storage.objectViewer`, para reconstruir y verificar la cadena.
- **Tres candados independientes** para que un evento escrito no cambie: el
  rol (no borra), la precondición con la que la API crea cada objeto
  (`ifGenerationMatch = 0`: solo si no existe) y la retención (nadie borra
  antes del plazo, ni un administrador). Cualquiera de los tres basta para
  que una sobrescritura falle.
- **`iam_member` y no `iam_binding`.** El binding es autoritativo sobre el rol
  y le quitaría al sink su propio `objectCreator`.
- **Mapas y no listas.** El correo de una cuenta recién creada no se conoce
  hasta el apply, y `for_each` necesita claves conocidas en el plan.

## Uso

```hcl
module "logging" {
  source = "../../modules/logging"

  project_id    = var.project_id
  region        = "us-central1"
  nombre_bucket = "mdc-dev-evidencia"
  etiquetas     = local.etiquetas_obligatorias

  # La API escribe evidencia (solo crear) y la relee para verificarla.
  escritores = { app-api = module.iam.miembros["app-api"] }
  lectores   = { app-api = module.iam.miembros["app-api"] }

  # En producción, tras confirmar el plazo con Cumplimiento:
  # bloquear_retencion = true
}
```
