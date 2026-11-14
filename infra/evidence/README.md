# evidence

Plantillas de los reportes de cumplimiento por marco, ambiente y periodo.

El registro de evidencia es append-only: cada decisión guarda commit, actor,
fecha, plan y veredicto. El artefacto firmado vive en un bucket con retention
lock; la base de datos solo guarda su hash y su ruta.

La retención se define según el marco más estricto aplicable. Debe confirmarse
con Cumplimiento **antes** de activar el retention lock, porque una vez aplicado
no se puede acortar.
