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

Los demás del diseño —decisiones, aprobaciones, excepciones, evidencia— siguen
pendientes.

## Autenticación

**No hay.** El diseño pide OIDC con cuatro roles: Compliance Lead, Aprobador,
Desarrollador y Auditor de solo lectura. Hasta que exista, la API no debe
exponerse fuera de un entorno de desarrollo.
