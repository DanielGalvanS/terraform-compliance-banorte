# API de Compliance Ops

Fastify con Zod y Drizzle. Expone la postura de cumplimiento y recibe los
hallazgos que detecta el pipeline.

```bash
npm run dev:api          # http://127.0.0.1:8080
npm test                 # pruebas de todos los workspaces
```

La documentación OpenAPI se genera sola y se navega en `/documentacion`.

## El catálogo no se duplica

`GET /marcos` y `GET /controles` leen **`infra/policies/mappings.yaml`**, el
mismo archivo que evalúa la compuerta del pipeline.

Copiarlo a la base habría sido más cómodo de consultar y habría acabado
discrepando: la API mostraría controles que ya no bloquean, o al revés. La
fuente de verdad es el archivo que firma Cumplimiento en el Gate 1.

## Todavía no hay base de datos

`db/esquema.ts` define las diez tablas con Drizzle, listas para cuando exista
el proyecto de GCP. Mientras tanto los hallazgos viven en memoria.

`GET /salud` lo dice sin rodeos: `persistencia: false` significa que lo que
sirve la API son datos de ejemplo. Conectar Postgres es añadir una
implementación de `HallazgosRepositorio`; las rutas no cambian.

## Idempotencia

`POST /hallazgos` acepta la cabecera `Idempotency-Key`. Con la misma clave, un
reintento devuelve el hallazgo ya registrado y responde **200 en vez de 201**.

Importa porque el pipeline reintenta, y un reintento no debe inflar el conteo
de incumplimientos que luego se reporta al auditor.

## Endpoints

| Método | Ruta | Para qué |
| --- | --- | --- |
| GET | `/salud` | Vida del servicio y si hay persistencia |
| GET | `/api/v1/resumen` | Cifras de portada |
| GET | `/api/v1/marcos` | Marcos en alcance |
| GET | `/api/v1/controles` | Controles y su mapeo; filtra por `?marco=` |
| GET | `/api/v1/hallazgos` | Hallazgos, con filtros |
| GET | `/api/v1/hallazgos/:id` | Un hallazgo |
| POST | `/api/v1/hallazgos` | Registra uno; acepta `Idempotency-Key` |
| PATCH | `/api/v1/hallazgos/:id/estado` | Cambia su estado; ver «Estados de un hallazgo» |
| GET | `/api/v1/excepciones` | Excepciones, con filtros; el estado se deriva de la fecha |
| POST | `/api/v1/excepciones` | Solicita una; siempre nace `Pendiente` |
| GET | `/api/v1/excepciones/:id` | Una excepción |
| POST | `/api/v1/excepciones/:id/aprobar` | La aprueba: pasa a `Activa` |
| POST | `/api/v1/excepciones/:id/rechazar` | La rechaza: pasa a `Rechazada` |
| POST | `/api/v1/decisiones` | Registra una decisión del agente; crea los hallazgos y el evento de evidencia |
| GET | `/api/v1/decisiones` | Decisiones del agente; filtra por `?hallazgoId=`, `?commit=` y `?estado=` |
| GET | `/api/v1/decisiones/:ejecucionId` | Una decisión |
| GET | `/api/v1/evidencia` | Registro de evidencia y si la cadena está íntegra; filtra por `?tipo=` y `?objetoId=` |

Siguen pendientes las decisiones del agente y las aprobaciones de despliegue.

## Decidir una excepción

Aprobar y rechazar son `POST` y no un `PATCH` del estado: son acciones con
reglas, no la edición de un campo. Las reglas viven en
`src/model/reglasExcepciones.ts` (`validarDecision`) para probarlas sin
servidor.

| Regla | Respuesta | Por qué |
| --- | --- | --- |
| Solo se decide una excepción **Pendiente y vigente** | 409 | Decidir dos veces, o aprobar algo vencido, rompe la trazabilidad |
| Quien decide no puede ser quien la solicitó (sin distinguir mayúsculas ni espacios) | 422 | Segregación de funciones: nadie se aprueba a sí mismo |
| El comentario es obligatorio, de al menos 10 caracteres | 422 | La decisión sin fundamento no es evidencia |
| Aprobar no cambia `venceEl` | — | La vigencia la acotó la solicitud (máximo 90 días) |

Quien solicita y quien decide llegan hoy en el cuerpo de la petición. Cuando
exista OIDC saldrán del token.

Cada decisión queda en el registro de evidencia.

## Estados de un hallazgo

`PATCH /hallazgos/:id/estado` solo acepta estas transiciones, definidas como
tabla en `src/model/reglasHallazgos.ts`:

| De | A |
| --- | --- |
| Abierto | En remediación, Cerrado |
| En remediación | Abierto, Cerrado |
| Cerrado | Abierto (reapertura, por ejemplo si el drift lo vuelve a detectar) |
| Excepción | ninguno por esta vía |

- Una transición que no está en la tabla, o pedir el estado actual, responde **409**.
- A **Excepción** no se llega por aquí, solo aprobando una excepción: pedirlo
  responde **422**. Si se pudiera marcar a mano, cualquiera se saltaría la
  aprobación humana.
- El comentario es obligatorio, de al menos 10 caracteres (**422**).
- Cada cambio queda en el registro de evidencia con `{ de, a, comentario }`.

## Decisiones del agente

`apps/agent` envía a `POST /decisiones` el mismo contenido de `decision.json`,
en camelCase. La API:

- **No cambia el bloqueo.** El resultado de la compuerta se copia; el agente
  solo explica y prioriza.
- **Crea un hallazgo por violación** cuando la compuerta bloqueó y el agente
  analizó. La severidad y el título salen del catálogo, no del cuerpo; un
  control que no está en el catálogo se registra como `Crítica`.
- **No duplica hallazgos.** La misma violación (ambiente, control, recurso y
  mensaje) vista en otro push reutiliza el hallazgo que ya existe.
- **No duplica decisiones.** Reenviar la misma `ejecucionId` responde 200 con lo
  ya registrado; reenviarla con otro contenido responde 409, porque una
  decisión no se corrige.
- **Registra el evento `agente.decision`** en la evidencia en todos los
  estados, también `error_agente`, con actor `app-agente` y el hash de la
  decisión completa.

`test/datos/decision_agente.json` es una salida real del agente. Si el agente
cambia sus campos, su prueba de contrato falla y hay que regenerarlo (ver
`apps/agent/README.md`).

## Evidencia

`GET /evidencia` devuelve las decisiones sobre excepciones, los cambios de
estado de hallazgos y las decisiones del agente, del más reciente al más
antiguo.

El registro **solo agrega**: no hay forma de editar ni borrar un evento. Cada
evento guarda el hash del anterior, y su propio hash es el sha256 de ese hash
más el JSON canónico del evento (claves ordenadas, para que el mismo evento dé
siempre el mismo hash). El primero se encadena a 64 ceros. Si alguien altera o
borra un evento intermedio, su hash y los de todos los siguientes dejan de
coincidir, y `integra` pasa a `false`.

**El límite:** en memoria esto no es inmutable de verdad, porque quien tenga
el proceso puede reescribir el arreglo. Lo que sí hace es que una alteración
sea **detectable**. La inmutabilidad real la da el bucket con retención del
módulo `infra/modules/logging`; esta estructura queda lista para escribir ahí.

## Autenticación

**No hay.** El diseño pide OIDC con cuatro roles: Compliance Lead, Aprobador,
Desarrollador y Auditor de solo lectura. Hasta que exista, la API no debe
exponerse fuera de un entorno de desarrollo.
