import { createHash } from 'node:crypto'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import {
  DecisionAgente,
  Error as ErrorRespuesta,
  FiltroDecisiones,
  type Hallazgo,
  NuevaDecision,
} from '../model/esquemas.ts'
import type { Catalogo } from '../repositorios/catalogoRepositorio.ts'
import type { DecisionesRepositorio } from '../repositorios/decisionesRepositorio.ts'
import { jsonCanonico, type EvidenciaRepositorio } from '../repositorios/evidenciaRepositorio.ts'
import type { HallazgosRepositorio } from '../repositorios/hallazgosRepositorio.ts'

/**
 * Quién registra. Sale del servidor y no del cuerpo: el agente corre con la
 * cuenta de servicio app-agente (CP-17). Cuando haya autenticación saldrá de
 * su token; nunca de lo que el cliente declare.
 */
export const ACTOR_AGENTE = 'app-agente'

const sha256 = (texto: string) => `sha256:${createHash('sha256').update(texto).digest('hex')}`

/**
 * La clave de idempotencia del hallazgo no incluye el commit: la misma regla
 * abierta en el mismo recurso, vista en dos pushes del mismo PR, es un solo
 * incumplimiento y no dos. Sí incluye el mensaje, porque una regla puede
 * violar el mismo control dos veces (puerto 22 y 3389).
 */
const claveHallazgo = (ambiente: string, control: string, recurso: string, mensaje: string) =>
  `agente:${sha256([ambiente, control, recurso, mensaje].join('\n'))}`

export function rutasDecisiones(
  catalogo: Catalogo,
  decisiones: DecisionesRepositorio,
  hallazgos: HallazgosRepositorio,
  evidencia: EvidenciaRepositorio,
): FastifyPluginAsyncZod {
  return async (app) => {
    app.post(
      '/decisiones',
      {
        schema: {
          summary: 'Registra una decisión del agente de cumplimiento',
          description:
            'Lo envía `python -m agente analizar` al terminar. Si la compuerta bloqueó y el ' +
            'agente analizó, registra un hallazgo por violación (o reutiliza el que ya existía) ' +
            'con la severidad del catálogo, no la del cuerpo. Siempre agrega un evento ' +
            'agente.decision a la evidencia con el hash de la decisión completa. Reenviar la ' +
            'misma ejecución responde 200 sin duplicar nada; reenviarla con otro contenido, 409.',
          tags: ['agente'],
          body: NuevaDecision,
          response: { 200: DecisionAgente, 201: DecisionAgente, 409: ErrorRespuesta },
        },
      },
      async (peticion, respuesta) => {
        const nueva = peticion.body
        const hashDecision = sha256(jsonCanonico(nueva))

        const existente = await decisiones.obtener(nueva.ejecucionId)
        if (existente !== null) {
          const { clasificaciones, registradaEn: _r, evidencia: _e, ...resto } = existente
          const original = {
            ...resto,
            clasificaciones: clasificaciones.map(({ hallazgoId: _h, ...c }) => c),
          }
          if (sha256(jsonCanonico(original)) !== hashDecision) {
            return respuesta.code(409).send({
              error: 'Esa ejecución ya se registró con otro contenido',
              detalle: 'Una decisión no se corrige: se registra una ejecución nueva.',
            })
          }
          return respuesta.code(200).send(existente)
        }

        // Solo hay hallazgos que registrar si la compuerta bloqueó y el agente
        // los clasificó. En los demás estados la decisión queda igual en la
        // evidencia, que es lo que pide DEV-46: registrar cada ejecución.
        const registrarHallazgos = nueva.resultadoCompuerta === 'bloqueado' && nueva.estado === 'analizado'
        const clasificaciones = []
        for (const c of nueva.clasificaciones) {
          if (!registrarHallazgos) {
            clasificaciones.push({ ...c, hallazgoId: null })
            continue
          }
          const control = catalogo.controles.find((k) => k.codigo === c.control)
          // Un control que no está en el catálogo se trata como crítico: es más
          // seguro que alguien lo revise de más a que pase desapercibido.
          const severidad: Hallazgo['severidad'] = control?.severidad ?? 'Crítica'
          const recurso = c.recurso ?? 'desconocido'
          const { hallazgo } = await hallazgos.crear(
            {
              control: control?.codigo ?? null,
              titulo: control?.titulo ?? `Control desconocido (${c.control})`,
              recurso,
              severidad,
              ambiente: nueva.ambiente,
              origen: nueva.origen,
              mensaje: c.mensaje,
            },
            claveHallazgo(nueva.ambiente, c.control, recurso, c.mensaje),
          )
          clasificaciones.push({ ...c, hallazgoId: hallazgo.id })
        }

        // Se registra después de crear los hallazgos: la evidencia describe lo
        // que pasó, incluidos los hallazgos que la decisión dejó.
        const evento = await evidencia.registrar({
          tipo: 'agente.decision',
          objetoId: nueva.ejecucionId,
          actor: ACTOR_AGENTE,
          detalle: {
            estado: nueva.estado,
            resultadoCompuerta: nueva.resultadoCompuerta,
            commit: nueva.commit,
            ambiente: nueva.ambiente,
            origen: nueva.origen,
            modelo: nueva.modelo ?? '',
            versionPrompt: nueva.versionPrompt,
            hashEntradas: nueva.hashEntradas,
            hashDecision,
            clasificaciones: String(nueva.clasificaciones.length),
            hallazgos: [...new Set(clasificaciones.flatMap((c) => c.hallazgoId ?? []))].join(','),
          },
        })

        const guardada = await decisiones.guardar({
          ...nueva,
          clasificaciones,
          registradaEn: evento.registradoEn,
          evidencia: { secuencia: evento.secuencia, hash: evento.hash },
        })
        return respuesta.code(201).send(guardada)
      },
    )

    app.get(
      '/decisiones',
      {
        schema: {
          summary: 'Decisiones del agente',
          description:
            'De la más reciente a la más antigua. Con `hallazgoId`, las que explican ese ' +
            'hallazgo: el detalle del dashboard toma de aquí la explicación y la prioridad.',
          tags: ['agente'],
          querystring: FiltroDecisiones,
          response: { 200: z.object({ decisiones: z.array(DecisionAgente) }) },
        },
      },
      async (peticion) => ({ decisiones: await decisiones.listar(peticion.query) }),
    )

    app.get(
      '/decisiones/:ejecucionId',
      {
        schema: {
          summary: 'Una decisión por ejecución',
          tags: ['agente'],
          params: z.object({ ejecucionId: z.uuid() }),
          response: { 200: DecisionAgente, 404: ErrorRespuesta },
        },
      },
      async (peticion, respuesta) => {
        const decision = await decisiones.obtener(peticion.params.ejecucionId)
        if (decision === null) {
          return respuesta.code(404).send({ error: 'No existe esa decisión' })
        }
        return decision
      },
    )
  }
}
