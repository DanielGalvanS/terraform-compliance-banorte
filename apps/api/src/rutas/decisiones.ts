import { randomUUID } from 'node:crypto'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { actor, requiere, respuestasAuth } from '../auth/autorizacion.ts'
import {
  DecisionAgente,
  Error as ErrorRespuesta,
  FiltroDecisiones,
  NuevaDecisionAgente,
} from '../model/esquemas.ts'
import { validarDecisionAgente } from '../model/reglasDecisiones.ts'
import { estadoVigente } from '../model/reglasExcepciones.ts'
import { coincideRecurso } from '../model/recursos.ts'
import type { Catalogo } from '../repositorios/catalogoRepositorio.ts'
import type { DecisionesRepositorio } from '../repositorios/decisionesRepositorio.ts'
import type { EvidenciaRepositorio } from '../repositorios/evidenciaRepositorio.ts'
import type { ExcepcionesRepositorio } from '../repositorios/excepcionesRepositorio.ts'
import type { HallazgosRepositorio } from '../repositorios/hallazgosRepositorio.ts'
import { respuestaSinEvidencia } from './respuestas.ts'

const ErrorValidacion = ErrorRespuesta.extend({
  motivos: z.array(z.object({ campo: z.string(), mensaje: z.string() })),
})

/**
 * Decisiones del agente de IA.
 *
 * La API registra la opinión del agente; no cambia veredictos, estados de
 * hallazgos ni excepciones por lo que diga. «Las políticas deciden; la IA
 * interpreta» (docs/arquitectura.md) sigue valiendo: el rol Agente solo tiene
 * `leer` y `registrarDecision`.
 */
export function rutasDecisiones(
  catalogo: Catalogo,
  repositorio: DecisionesRepositorio,
  hallazgos: HallazgosRepositorio,
  excepciones: ExcepcionesRepositorio,
  evidencia: EvidenciaRepositorio,
): FastifyPluginAsyncZod {
  const severidadDe = (codigo: string) =>
    catalogo.controles.find((c) => c.codigo === codigo)?.severidad ?? null

  return async (app) => {
    app.post(
      '/decisiones',
      {
        onRequest: requiere('registrarDecision'),
        schema: {
          summary: 'Registra la decisión de una ejecución del agente',
          description:
            'Solo el rol Agente. Idempotente por ejecucionId: repetir el envío con el ' +
            'mismo contenido (mismo hashEntradas) responde 200 con lo ya registrado; con ' +
            'otro contenido, 409. La API vuelve a comprobar la coherencia de la decisión ' +
            '(422): el estado corresponde al veredicto, la severidad es la del catálogo y ' +
            '«ninguna» acción solo se acepta con una excepción activa. Queda en el ' +
            'registro de evidencia.',
          tags: ['agente'],
          body: NuevaDecisionAgente,
          response: {
            ...respuestasAuth,
            200: DecisionAgente,
            201: DecisionAgente,
            409: ErrorRespuesta,
            422: ErrorValidacion,
            ...respuestaSinEvidencia,
          },
        },
      },
      async (peticion, respuesta) => {
        const nueva = peticion.body

        // El agente reintenta si la red falla; un reintento no debe duplicar
        // la decisión ni la evidencia.
        const previa = await repositorio.porEjecucion(nueva.ejecucionId)
        if (previa !== null) {
          if (previa.hashEntradas === nueva.hashEntradas) return respuesta.code(200).send(previa)
          return respuesta.code(409).send({
            error: 'Esa ejecución ya está registrada con otras entradas',
          })
        }

        const activas = await excepciones.listar({ estado: 'Activa' })
        const motivos = validarDecisionAgente(nueva, severidadDe, (control, recurso) =>
          activas.some(
            (e) =>
              e.control === control &&
              // Doble comprobación: el filtro ya deriva el estado, pero si
              // venció entre tanto no debe contar.
              estadoVigente(e.estadoGuardado, e.venceEl) === 'Activa' &&
              (recurso === null || coincideRecurso(e.recurso, recurso)),
          ),
        )
        if (motivos.length > 0) {
          return respuesta.code(422).send({ error: 'La decisión no es coherente', motivos })
        }

        const clasificaciones = await Promise.all(
          nueva.clasificaciones.map(async (c) => {
            const relacionados =
              c.recurso === null ? [] : await hallazgos.listar({ control: c.control, recurso: c.recurso })
            // Se prefiere uno que siga abierto: es el que esta decisión explica.
            const elegido =
              relacionados.find((h) => h.estado === 'Abierto' || h.estado === 'En remediación') ??
              relacionados[0]
            return { ...c, hallazgoId: elegido?.id ?? null }
          }),
        )

        const quien = actor(peticion)
        // Evidencia primero: si el bucket no la acepta, responde 503 y la
        // decisión no se guarda. El agente lo trata como cualquier otro fallo
        // de registro y bloquea el pipeline.
        const id = randomUUID()
        await evidencia.registrar({
          tipo: 'agente.decision',
          objetoId: id,
          actor: quien.nombre,
          detalle: {
            ejecucionId: nueva.ejecucionId,
            estado: nueva.estado,
            resultadoCompuerta: nueva.resultadoCompuerta,
            hashEntradas: nueva.hashEntradas,
            sujeto: quien.sujeto,
          },
        })
        const decision = await repositorio.crear({
          ...nueva,
          id,
          clasificaciones,
          registradaPor: quien.nombre,
        })
        return respuesta.code(201).send(decision)
      },
    )

    app.get(
      '/decisiones',
      {
        onRequest: requiere('leer'),
        schema: {
          summary: 'Decisiones del agente, de la más reciente a la más antigua',
          tags: ['agente'],
          querystring: FiltroDecisiones,
          response: { ...respuestasAuth, 200: z.object({ decisiones: z.array(DecisionAgente) }) },
        },
      },
      async (peticion) => ({ decisiones: await repositorio.listar(peticion.query) }),
    )

    app.get(
      '/decisiones/:id',
      {
        onRequest: requiere('leer'),
        schema: {
          summary: 'Una decisión del agente',
          tags: ['agente'],
          params: z.object({ id: z.uuid() }),
          response: { ...respuestasAuth, 200: DecisionAgente, 404: ErrorRespuesta },
        },
      },
      async (peticion, respuesta) => {
        const decision = await repositorio.obtener(peticion.params.id)
        if (decision === null) return respuesta.code(404).send({ error: 'No existe esa decisión' })
        return decision
      },
    )
  }
}
