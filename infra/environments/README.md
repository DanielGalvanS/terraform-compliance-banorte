# environments

Composición de módulos por ambiente. Cada ambiente declara su propio backend
remoto y sus etiquetas obligatorias.

El nivel de autonomía del agente depende del ambiente:

| Ambiente | Severidad baja o media        | Severidad alta o crítica |
|----------|-------------------------------|--------------------------|
| `dev`    | PR con merge automático       | PR y aprobación          |
| `qa`     | PR con merge automático       | PR y aprobación          |
| `prod`   | Siempre aprobación humana     | Doble aprobación         |

En producción el agente nunca aplica por sí solo, sin importar la severidad.

| Ambiente | Estado |
| --- | --- |
| `dev` | Integrado: los ocho módulos compuestos |
| `qa` | Pendiente |
| `prod` | Pendiente |
