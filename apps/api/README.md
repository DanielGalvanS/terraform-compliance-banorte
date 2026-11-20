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
| GET | `/salud` | Vida del servicio y si hay persistencia (pública) |
| POST | `/api/v1/sesion` | Inicia sesión con un usuario de demostración; solo en modo local (pública) |
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
| Quien decide no puede ser quien la solicitó: mismo sujeto del token, o mismo nombre sin distinguir mayúsculas ni espacios | 422 | Segregación de funciones: nadie se aprueba a sí mismo |
| El comentario es obligatorio, de al menos 10 caracteres | 422 | La decisión sin fundamento no es evidencia |
| Aprobar no cambia `venceEl` | — | La vigencia la acotó la solicitud (máximo 90 días) |

Quien solicita y quien decide salen del token, nunca del cuerpo de la
petición. Se compara también el sujeto del token (`sub`) porque la persona no
lo controla: cambiar su nombre en el proveedor de identidad no le permite
aprobar lo suyo.

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

## Evidencia

`GET /evidencia` devuelve las decisiones sobre excepciones y los cambios de
estado de hallazgos, del más reciente al más antiguo.

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

## Autenticación y roles

Toda ruta de `/api/v1` exige `Authorization: Bearer <token>`, salvo
`/sesion`. Sin token, o con uno inválido o vencido, responde **401**; con un
rol que no alcanza, **403**. La autorización corre antes de leer el cuerpo, así
que quien no tiene permiso no recibe el detalle de validación.

### Quién puede qué

La tabla vive en `src/model/permisos.ts`:

| Acción | Compliance Lead | Aprobador | Desarrollador | Auditor | Agente | Pipeline |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| Leer todo | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Solicitar excepción | ✓ | | ✓ | | | |
| Aprobar o rechazar excepción | ✓ | ✓ | | | | |
| Revocar excepción | ✓ | | | | | |
| Cambiar estado de hallazgo | ✓ | ✓ | ✓ | | | |
| Registrar hallazgo | ✓ | | | | | ✓ |
| Registrar decisión del agente | | | | | ✓ | |

- El **Auditor solo lee**: si pudiera cambiar algo, dejaría de ser
  independiente de lo que audita.
- El **Agente** registra su opinión y nada más: no decide excepciones ni
  cambia estados. Las políticas deciden; la IA interpreta.

### Dos modos

Las rutas dependen de la interfaz `Verificador` (`src/auth/verificador.ts`),
así que cambiar de modo no toca ninguna ruta.

| `AUTH_MODO` | Quién firma los tokens | Para qué |
| --- | --- | --- |
| `local` (por defecto) | La propia API, con HS256 y `AUTH_SECRETO` | Desarrollo y pruebas |
| `jwks` | El proveedor de identidad; se verifican con sus llaves públicas (`AUTH_JWKS_URL`, `AUTH_EMISOR`, `AUTH_AUDIENCIA`) | Cualquier ambiente real |

En modo `jwks` el rol sale del claim `rol`. Un token sin ese claim no tiene
permisos: no se supone un rol por defecto.

### Modo local: usuarios de demostración

`POST /api/v1/sesion` acepta cuatro usuarios, uno por rol de persona, todos
con la contraseña `demo`:

| Correo | Rol |
| --- | --- |
| `ana.martinez@banco.mx` | Compliance Lead |
| `roberto.silva@banco.mx` | Aprobador |
| `carlos.vega@banco.mx` | Desarrollador |
| `lucia.ramos@banco.mx` | Auditor |

**Esto no es seguridad**: la contraseña es pública y sirve para elegir con qué
rol probar. Por eso:

- `/sesion` solo existe con `AUTH_MODO=local`; en `jwks` responde 404.
- La API **no arranca** en modo local si hay `DATABASE_URL`: los usuarios de
  demostración no deben convivir con datos reales.
- Si no se fija `AUTH_SECRETO`, se genera uno al azar en cada arranque. Un
  secreto escrito en el código sería el mismo en todas las copias del
  repositorio y cualquiera podría firmar tokens.

Tokens para servicios (el agente y el pipeline), con el mismo `AUTH_SECRETO`
con el que arranca la API:

```bash
export AUTH_SECRETO="$(openssl rand -hex 32)"
npm run dev:api
npm run token --workspace @compliance-ops/api -- --rol Agente     # en otra terminal, mismo AUTH_SECRETO
```

### El frontend

La pantalla de acceso llama a `/sesion` y guarda el token **en memoria**, no
en `localStorage`: un script inyectado en la página podría leer
`localStorage` y llevárselo. El costo es que al recargar hay que volver a
entrar. `/sesion` devuelve también los permisos del rol, y la pantalla oculta
lo que no se puede hacer sin copiar la tabla; la API lo vuelve a comprobar de
todos modos.
