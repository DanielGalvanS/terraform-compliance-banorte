# Agente de cumplimiento

Un solo agente de [Google ADK](https://google.github.io/adk-docs/) que lee el
veredicto de la compuerta de políticas y, por cada violación, la **explica, la
prioriza y sugiere qué hacer**. Usa Gemini.

**El agente no decide si un cambio se bloquea.** Eso lo decide la compuerta
(`infra/pipelines/scripts/policy_check.sh`), y el agente no tiene forma de
cambiarlo:

- Sus cuatro herramientas son de solo lectura.
- El resultado de la compuerta y la severidad los copia el código, no el modelo.
- El modelo puede subir la urgencia de una violación, nunca bajarla de lo que
  marca su severidad, y solo puede sugerir «ninguna» acción si el código confirma
  una excepción activa en la API. Los secretos expuestos (CO-SEC-01) y los
  permisos amplios de IAM (CO-IAM-01) siempre se escalan, aunque el modelo
  sugiera un PR. Cada corrección queda en `ajustes`.
- El texto del modelo se neutraliza antes del comentario del PR: no menciona a
  nadie con `@`, ni inserta HTML, imágenes o enlaces.
- Si el agente falla o responde algo incompleto, la decisión es `error_agente`,
  el comando sale con código 1 y el pipeline bloquea (regla segura, DEV-46).

```
veredicto.json + plan.json ─► violaciones + plan sanitizado ─► agente ADK (Gemini)
                                                                │ consultar_control
                                                                │ consultar_recurso
                                                                │ buscar_hallazgos
                                                                │ buscar_excepciones
                                                                ▼
                         respuesta validada (Pydantic + invariantes) ─► decision.json
                                                                         comentario.md
```

## Archivos

| Archivo | Qué hace |
|---|---|
| `agente/agent.py` | Define el agente: modelo, instrucción, herramientas y esquema de salida. |
| `agente/instruccion.py` | El prompt, con versión (`VERSION_PROMPT`). |
| `agente/herramientas.py` | Las herramientas de solo lectura. |
| `agente/sanitizar.py` | Qué parte del plan puede ver el modelo: una lista de lo permitido, sin secretos ni correos. |
| `agente/violaciones.py` | Veredicto → violaciones con id (`V01`…) y dirección del recurso. |
| `agente/catalogo.py` | Lee `infra/policies/mappings.yaml`, la misma fuente que la compuerta y la API. |
| `agente/ejecutar.py` | Corre el agente, reintenta una vez e impone los invariantes. |
| `agente/acciones.py` | Lo que el agente no puede hacer por sí mismo. Hoy solo genera el comentario del PR. |
| `agente/cli.py` | `python -m agente analizar …` |

## Correrlo en local

```bash
cd apps/agent
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt

# Pruebas: no llaman a Gemini.
.venv/bin/python -m pytest
```

Para hablar con el modelo de verdad, antes de tener el proyecto de GCP, se usa
una llave gratuita de [Google AI Studio](https://aistudio.google.com/apikey).
**Solo con los planes de ejemplo**, nunca con planes reales.

```bash
export GOOGLE_API_KEY=...            # en tu terminal, nunca en el repo
.venv/bin/python -m agente analizar \
  --veredicto tests/datos/veredicto_violaciones.json \
  --plan ../../infra/policies/fixtures/plan_violaciones.json \
  --salida decision.json --comentario comentario.md

# Interfaz de ADK para ver el razonamiento y las herramientas que usa
.venv/bin/adk web .
```

Con GCP se cambia a Vertex AI, autenticado como la cuenta `app-agente`:

```bash
export GOOGLE_GENAI_USE_VERTEXAI=TRUE
export GOOGLE_CLOUD_PROJECT=<proyecto>
export GOOGLE_CLOUD_LOCATION=us-central1
```

| Variable | Para qué | Por defecto |
|---|---|---|
| `MODELO_AGENTE` | Modelo de Gemini | `gemini-3.5-flash` |
| `MODELO_RESPALDO` | Modelo del segundo intento si el primero falla; vacío lo desactiva | `gemini-3.5-flash-lite` |
| `API_URL` | API de cumplimiento, para `buscar_hallazgos` y `buscar_excepciones` | sin API: las búsquedas responden "no disponible" |
| `API_TOKEN` | Token del agente para la API (rol `Agente`, solo lectura más registrar su decisión). En desarrollo: `AUTH_SECRETO=… npm run token --workspace @compliance-ops/api -- --rol Agente`. Nunca llega al modelo | sin token: la API responde 401 y las búsquedas dan "no disponible" |
| `AGENTE_DEBUG` | `1` muestra el rastro completo de ADK cuando Gemini falla | apagado: el motivo sale en una línea |
| `RUTA_CATALOGO` | Catálogo de controles | `infra/policies/mappings.yaml` |

## Salida

`decision.json` es el registro que pide DEV-46. Contiene:

- las entradas (su hash);
- el veredicto copiado;
- una clasificación por violación: prioridad, explicación, riesgo, remediación, acción sugerida, confianza y citas del catálogo;
- las herramientas usadas;
- los `ajustes` que el código hizo a la opinión del modelo;
- los `intentos_fallidos`, con el modelo y el motivo («modelo saturado o sin respuesta (503)»);
- el modelo que respondió y la versión del prompt.

| `estado` | Cuándo | Código de salida |
|---|---|---|
| `analizado` | Clasificó todas las violaciones | 0 |
| `sin_violaciones` | La compuerta dio conforme; no se llama al modelo | 0 |
| `sin_analisis` | La compuerta dio error, o bloqueó sin violaciones legibles; ya bloquea ella | 0 |
| `error_agente` | El modelo falló, se tardó o respondió incompleto | 1 (bloquea) |

## Si Gemini falla

Con la llave gratuita es común que un modelo esté saturado (503). Cada llamada
a Gemini corta a los 60 s con dos reintentos, y si el primer intento falla el
segundo usa `MODELO_RESPALDO`. Para ver qué modelos acepta tu llave:

```bash
.venv/bin/python -c "from google import genai; print([m.name for m in genai.Client().models.list() if 'flash' in m.name])"
```

| Motivo en `error` | Qué hacer |
|---|---|
| `modelo saturado o sin respuesta (503)` | Esperar unos minutos o cambiar `MODELO_AGENTE` |
| `cuota del modelo agotada (429)` | Esperar un minuto; la capa gratuita tiene límite por minuto |
| `el modelo no existe para esta cuenta (404)` | Elegir otro de la lista de arriba |
| `la llave o la cuenta no puede usar el modelo` | Revisar `GOOGLE_API_KEY` o los permisos de `app-agente` |

## Datos de prueba

`tests/datos/veredicto_*.json` son la salida real de la compuerta sobre
`infra/policies/fixtures/`, con la fecha y el commit fijos. Si cambia una
política, la prueba `test_los_datos_de_prueba_coinciden_con_la_compuerta_real`
falla en CI. Para regenerarlos:

```bash
bash infra/pipelines/scripts/policy_check.sh infra/policies/fixtures/plan_violaciones.json /tmp/v.json
```

Después se copia el resultado a `tests/datos/veredicto_violaciones.json`,
dejando `fecha`, `commit` y `actor` con los valores fijos y `archivo` como
ruta relativa (`infra/policies/fixtures/plan_violaciones.json`).

## Siguiente

- Registrar cada decisión en la API y en la cadena de evidencia.
- Agregar el paso del agente en `plan.yml`.
- Escalar a Jira (DEV-51).
- Desplegar en Cloud Run para el drift.
- Proponer PR de remediación (DEV-50).
