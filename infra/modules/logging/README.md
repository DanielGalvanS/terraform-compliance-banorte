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

## Uso

```hcl
module "logging" {
  source = "../../modules/logging"

  project_id    = var.project_id
  region        = "us-central1"
  nombre_bucket = "mdc-dev-evidencia"
  etiquetas     = local.etiquetas_obligatorias

  # En producción, tras confirmar el plazo con Cumplimiento:
  # bloquear_retencion = true
}
```
