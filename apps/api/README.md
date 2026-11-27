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
sirve la API son datos de ejemplo. La evidencia puede ir al bucket aunque no
haya base: ver «Evidencia». Conectar Postgres es añadir una
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
| GET | `/api/v1/hallazgos` | Hallazgos, con filtros; `?recurso=` acepta la dirección con módulo. El estado considera las excepciones vigentes |
| GET | `/api/v1/hallazgos/:id` | Un hallazgo |
| POST | `/api/v1/hallazgos` | Registra uno; acepta `Idempotency-Key` |
| PATCH | `/api/v1/hallazgos/:id/estado` | Cambia su estado; ver «Estados de un hallazgo» |
| GET | `/api/v1/excepciones` | Excepciones, con filtros (también `?recurso=` y `?porVencer=`); el estado y la vigencia se derivan de la fecha |
| POST | `/api/v1/excepciones` | Solicita una; siempre nace `Pendiente` |
| GET | `/api/v1/excepciones/:id` | Una excepción |
| POST | `/api/v1/excepciones/:id/aprobar` | La aprueba: pasa a `Activa` |
| POST | `/api/v1/excepciones/:id/rechazar` | La rechaza: pasa a `Rechazada` |
| POST | `/api/v1/excepciones/:id/revocar` | La revoca: pasa a `Revocada`; solo Compliance Lead |
| GET | `/api/v1/evidencia` | Registro de evidencia y si la cadena está íntegra; filtra por `?tipo=` y `?objetoId=` |
| POST | `/api/v1/decisiones` | El agente registra la decisión de una ejecución; solo rol Agente |
| GET | `/api/v1/decisiones` | Decisiones del agente; filtra por `?ejecucionId=` y `?estado=` |
| GET | `/api/v1/decisiones/:id` | Una decisión |

Siguen pendientes las aprobaciones de despliegue.

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

## Decisiones del agente

El agente (`apps/agent`) lee hallazgos y excepciones con `GET` y, al terminar
cada ejecución, registra su decisión con `POST /decisiones`. Es lo único que
puede escribir: **la API registra la opinión del agente, pero no cambia
veredictos, hallazgos ni excepciones por lo que diga**.

- **Idempotente por `ejecucionId`.** El agente reintenta si la red falla. Con
  el mismo `hashEntradas` responde 200 con lo ya registrado; con otro, 409,
  porque dos decisiones distintas con el mismo id no pueden ser la misma
  ejecución.
- **La API vuelve a comprobar la coherencia** (`src/model/reglasDecisiones.ts`),
  aunque el agente ya lo hace: el texto lo escribe un modelo que lee planes
  editables por cualquiera.

| Regla | Respuesta |
| --- | --- |
| Un veredicto `conforme` corresponde exactamente a `sin_violaciones` | 422 |
| `analizado` solo con veredicto `bloqueado` y al menos una clasificación | 422 |
| Los demás estados no llevan clasificaciones | 422 |
| El control existe en el catálogo y la severidad es la suya | 422 |
| «Ninguna» acción solo si hay una excepción activa para ese control y recurso | 422 |

- Cada clasificación se liga al hallazgo del mismo control y recurso, si
  existe (`hallazgoId`), prefiriendo uno abierto.
- Cada registro deja un evento `agente.decision` en la evidencia, con el
  `hashEntradas` que lo liga al `decision.json` completo del pipeline.

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
- Un hallazgo cubierto por una excepción vigente **no se cambia por aquí**
  (409): hay que revocar la excepción o esperar a que venza.

## Vigencia de las excepciones

Una excepción aprobada **cubre** los hallazgos del mismo control, el mismo
ambiente y el mismo recurso (la dirección con módulo cuenta como el mismo
recurso). Las reglas están en `src/model/reglasVigencia.ts`.

**El estado del hallazgo se deriva al leer, no se guarda.** Mientras una
excepción activa y vigente lo cubre, un hallazgo `Abierto` o `En remediación`
se muestra como `Excepción`, con la referencia a la excepción en el campo
`excepcion`. El día que la excepción vence, o en cuanto se revoca, vuelve solo
a su estado. Es la misma idea que `Vencida`: no depende de un proceso
programado que alguien pueda olvidar, y un hallazgo nunca queda marcado como
exceptuado con la excepción ya vencida.

Todo lo que lee hallazgos usa ese estado: la lista y su filtro `?estado=`, el
detalle, el resumen y el inventario. Un hallazgo cubierto no cuenta como
abierto.

Cada excepción trae además:

| Campo | Qué es |
| --- | --- |
| `diasRestantes` | Días hasta `venceEl`, solo si está pendiente o activa |
| `porVencer` | Activa y a 7 días o menos de vencer; se filtra con `?porVencer=true` |
| `hallazgosAfectados` | Hallazgos abiertos que cubre si está activa, o cubriría si se aprueba |

### Revocar

`POST /excepciones/:id/revocar` retira una excepción antes de que venza, por
ejemplo porque el incumplimiento ya se corrigió.

| Regla | Respuesta |
| --- | --- |
| Solo Compliance Lead | 403 |
| Solo una excepción activa y vigente; una pendiente se rechaza y una vencida ya no protege nada | 409 |
| El motivo es obligatorio, de al menos 10 caracteres | 422 |

Quién revoca y por qué se guardan en `revocadaPor`, `revocadaEn` y
`motivoRevocacion`, sin tocar `aprobadaPor`: se conserva quién la había
aprobado. Queda el evento `excepcion.revocada` en la evidencia.

No hay regla de segregación de funciones: revocar reduce el riesgo en vez de
aceptarlo, y quien solicitó la excepción debe poder pedir que se retire.

## Evidencia

`GET /evidencia` devuelve las decisiones sobre excepciones y los cambios de
estado de hallazgos, del más reciente al más antiguo.

El registro **solo agrega**: no hay forma de editar ni borrar un evento. Cada
evento guarda el hash del anterior, y su propio hash es el sha256 de ese hash
más el JSON canónico del evento (claves ordenadas, para que el mismo evento dé
siempre el mismo hash). El primero se encadena a 64 ceros. Si alguien altera o
borra un evento intermedio, su hash y los de todos los siguientes dejan de
coincidir, y `integra` pasa a `false`.

### Dónde vive

| `EVIDENCIA_BUCKET` | Dónde | Qué garantiza |
| --- | --- | --- |
| Sin definir | En memoria | La alteración es **detectable**, pero no se impide y se pierde al reiniciar |
| Nombre del bucket | El bucket con retención de `infra/modules/logging` | La alteración se **impide**, y la cadena sobrevive a reinicios |

`GET /salud` lo dice: `evidencia: 'memoria'` o `'bucket'`.

### En el bucket

- **Cada evento es un objeto propio**, `evidencia/<secuencia en 10 dígitos>.json`,
  con el JSON canónico. El orden de los nombres es el orden de la cadena.
- **Nadie lo puede sobrescribir**, ni la propia API, por tres candados
  independientes:
  - la API crea cada objeto con `ifGenerationMatch = 0`, que en GCS significa
    «solo si no existe»;
  - su cuenta solo tiene `roles/storage.objectCreator`, que no borra;
  - la retención impide borrar antes del plazo, incluso a un administrador.
- **Varias instancias:** dos instancias de Cloud Run no pueden crear la misma
  secuencia. La que pierde recarga la cadena y reintenta con la siguiente.
- **`verificar` relee el bucket**, no solo el índice en memoria: detecta un
  objeto alterado aunque la API no se haya enterado. Son tantas lecturas como
  eventos; con volumen real habría que verificar por tramos.

### Sin evidencia no hay cambio

Aprobar, rechazar, revocar, cambiar el estado de un hallazgo y registrar una
decisión del agente **escriben la evidencia antes de aplicar el cambio**. Si el
bucket no la acepta, responden **503** y el cambio no se aplica. Un cambio sin
evidencia es peor que la evidencia de un intento; lo segundo solo puede pasar
si el cambio falla después de validarse, y con Postgres irá en una
transacción.

| Situación | Qué pasa |
| --- | --- |
| El bucket no responde al arrancar | La API no arranca: no aceptaría cambios sin poder registrarlos |
| La cadena está alterada al arrancar | Arranca, lo deja en el log y `GET /evidencia` muestra `integra: false` |
| Un objeto ya no es un evento legible | No se sigue encadenando: todo cambio responde 503 hasta que alguien lo revise |
| El bucket no responde al verificar | `GET /evidencia` responde 503 |

### Lo que falta

- Probar contra GCP real: `almacenGcs` se prueba con un cliente falso, porque
  aún no hay proyecto.
- En producción, `bloquear_retencion = true` cuando Cumplimiento confirme el
  plazo. Mientras no se bloquee, la retención la puede acortar un
  administrador.

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
| `jwks` | Identity Platform; se verifican con sus llaves públicas (`AUTH_JWKS_URL`, `AUTH_EMISOR`, `AUTH_AUDIENCIA`) | Cualquier ambiente real |

En modo `jwks` el rol sale del claim personalizado `rol`, que asigna
`scripts/identidad/crear_usuarios.sh`. Un token sin ese claim no tiene
permisos: no se supone un rol por defecto. El nombre que queda en la evidencia
es el `displayName` del usuario o, si no tiene, su correo.

`GET /api/v1/yo` devuelve el usuario del token y sus permisos en los dos
modos. Con Identity Platform la pantalla inicia sesión con el proveedor y
pregunta ahí qué puede mostrar.

En dev, la API pasa a `jwks` con `login_real = true` en Terraform. El orden
para hacerlo sin dejar a nadie fuera está en `docs/despliegue.md` («Paso 5»).

**Pendiente:** el agente y el pipeline todavía no llaman a la API desplegada.
Cuando lo hagan, sus tokens serán los de su cuenta de servicio (de Google, sin
claim `rol`) y habrá que mapear cada cuenta a su rol.

### Modo local: usuarios de demostración

`POST /api/v1/sesion` acepta cuatro usuarios, uno por rol de persona, todos
con la contraseña `demo`:

| Correo | Rol |
| --- | --- |
| `compliance@banorte.mx` | Compliance Lead |
| `aprobador@banorte.mx` | Aprobador |
| `desarrollador@banorte.mx` | Desarrollador |
| `auditor@banorte.mx` | Auditor |

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

## Imagen para Cloud Run

```bash
docker build -f apps/api/Dockerfile -t cumplimiento-api .   # desde la raíz del repo
docker run --rm -p 8080:8080 cumplimiento-api
```

Se construye desde la raíz porque necesita el lockfile del monorepo y el
catálogo de la compuerta, que se copia dentro de la imagen
(`RUTA_CATALOGO=/app/infra/policies/mappings.yaml`). Escucha en `0.0.0.0:8080`,
corre como el usuario `node` y aguanta el sistema de archivos en solo lectura.
`node` arranca directo, sin `npm`, para que la señal `SIGTERM` de Cloud Run le
llegue y la API cierre en orden.

El job **Imágenes de Cloud Run** del workflow `aplicaciones.yml` la construye,
la arranca y comprueba `/salud` y el cierre con `SIGTERM` en cada PR. No la
publica: eso lo hace el despliegue.
