import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { actor, requiere, respuestasAuth } from '../auth/autorizacion.ts'
import {
  Error as ErrorRespuesta,
  Excepcion,
  FiltroExcepciones,
  NuevaExcepcion,
  type HallazgoGuardado,
  type Identidad,
} from '../model/esquemas.ts'
import { cubre, diasRestantes, porVencer } from '../model/reglasVigencia.ts'
import type { HallazgosRepositorio } from '../repositorios/hallazgosRepositorio.ts'
import {
  estadoVigente,
  validarDecision,
  validarRevocacion,
  validarSolicitud,
} from '../model/reglasExcepciones.ts'
import type { Catalogo } from '../repositorios/catalogoRepositorio.ts'
import type { EvidenciaRepositorio } from '../repositorios/evidenciaRepositorio.ts'
import type {
  Decision,
  ExcepcionesRepositorio,
  ExcepcionGuardada,
} from '../repositorios/excepcionesRepositorio.ts'

/** Error con el detalle de cada campo rechazado, no solo un mensaje suelto. */
const ErrorValidacion = ErrorRespuesta.extend({
  motivos: z.array(z.object({ campo: z.string(), mensaje: z.string() })),
})

const ParametrosId = z.object({ id: z.uuid() })

// Quien decide sale del token, no del cuerpo: si el cliente pudiera
// declararlo, cualquiera aprobaría a nombre del aprobador.
// El comentario no lleva mínimo aquí para que la regla responda 422 con
// `motivos`, igual que el resto de las reglas, y no un 400 genérico de Zod.
const CuerpoDecision = z.object({
  comentario: z.string().describe('Fundamento de la decisión'),
})

const respuestasDecision = {
  ...respuestasAuth,
  200: Excepcion,
  404: ErrorRespuesta,
  409: ErrorRespuesta,
  422: ErrorValidacion,
}

export function rutasExcepciones(
  catalogo: Catalogo,
  repositorio: ExcepcionesRepositorio,
  hallazgos: HallazgosRepositorio,
  evidencia: EvidenciaRepositorio,
): FastifyPluginAsyncZod {
  /** Los hallazgos que una excepción puede cubrir: los que siguen sin resolver. */
  const hallazgosAbiertos = async () =>
    (await hallazgos.listar({})).filter(
      (h) => h.estado === 'Abierto' || h.estado === 'En remediación',
    )

  /**
   * Completa la excepción con los datos del control, su estado vigente y su
   * vigencia. Nada de esto se guarda: el nombre, el marco y la severidad se
   * toman del catálogo al leer, para que una excepción no congele una
   * descripción obsoleta, y los días restantes cambian solos cada día.
   */
  const completar = (
    guardada: ExcepcionGuardada,
    abiertos: readonly HallazgoGuardado[],
  ): z.infer<typeof Excepcion> => {
    const control = catalogo.controles.find((c) => c.codigo === guardada.control)
    const { estadoGuardado, solicitanteSujeto: _, ...resto } = guardada
    return {
      ...resto,
      controlNombre: control?.titulo ?? 'Control desconocido',
      marco: control?.mapeo[0]?.marco ?? '—',
      severidad: control?.severidad ?? 'Media',
      estado: estadoVigente(estadoGuardado, guardada.venceEl),
      diasRestantes: diasRestantes(guardada),
      porVencer: porVencer(guardada),
      hallazgosAfectados: abiertos.filter((h) => cubre(guardada, h)).length,
    }
  }

  const listar = async (filtro: z.infer<typeof FiltroExcepciones>) => {
    const { porVencer: soloPorVencer, ...resto } = filtro
    const [guardadas, abiertos] = await Promise.all([repositorio.listar(resto), hallazgosAbiertos()])
    const completas = guardadas.map((e) => completar(e, abiertos))
    return soloPorVencer === undefined
      ? completas
      : completas.filter((e) => e.porVencer === (soloPorVencer === 'true'))
  }

  /**
   * Aplica una decisión y devuelve el código y el cuerpo a responder.
   * Aprobar y rechazar comparten las reglas; solo cambia el estado destino.
   */
  const decidir = async (
    id: string,
    estado: Decision['estado'],
    quien: Identidad,
    comentario: string,
  ) => {
    const guardada = await repositorio.obtener(id)
    if (guardada === null) {
      return { codigo: 404 as const, cuerpo: { error: 'No existe esa excepción' } }
    }

    const { conflicto, motivos } = validarDecision(guardada, {
      decididaPor: quien.nombre,
      sujeto: quien.sujeto,
      comentario,
    })
    // El conflicto va primero: si ya no se puede decidir, corregir los datos
    // no cambiaría la respuesta.
    if (conflicto !== null) {
      return { codigo: 409 as const, cuerpo: { error: conflicto } }
    }
    if (motivos.length > 0) {
      return {
        codigo: 422 as const,
        cuerpo: { error: 'La decisión no cumple las reglas de excepción', motivos },
      }
    }

    const decidida = await repositorio.decidir(id, {
      estado,
      decididaPor: quien.nombre,
      comentario: comentario.trim(),
      decididaEn: new Date().toISOString(),
    })
    // Pudo desaparecer entre obtener y decidir; con Postgres no es teórico.
    if (decidida === null) {
      return { codigo: 404 as const, cuerpo: { error: 'No existe esa excepción' } }
    }

    // Se registra después de decidir, no antes: la evidencia describe lo que
    // pasó, y una decisión que falló no pasó.
    await evidencia.registrar({
      tipo: estado === 'Activa' ? 'excepcion.aprobada' : 'excepcion.rechazada',
      objetoId: decidida.id,
      actor: quien.nombre,
      detalle: {
        codigo: decidida.codigo,
        comentario: decidida.comentarioDecision ?? '',
        sujeto: quien.sujeto,
      },
    })
    return { codigo: 200 as const, cuerpo: completar(decidida, await hallazgosAbiertos()) }
  }

  return async (app) => {
    app.get(
      '/excepciones',
      {
        onRequest: requiere('leer'),
        schema: {
          summary: 'Excepciones registradas',
          description:
            'El estado se deriva de la fecha: una excepción activa cuya vigencia pasó ' +
            'se devuelve como Vencida aunque nadie haya corrido un proceso que la marque.',
          tags: ['excepciones'],
          querystring: FiltroExcepciones,
          response: { ...respuestasAuth, 200: z.object({ excepciones: z.array(Excepcion) }) },
        },
      },
      async (peticion) => ({
        excepciones: await listar(peticion.query),
      }),
    )

    app.post(
      '/excepciones',
      {
        onRequest: requiere('solicitarExcepcion'),
        schema: {
          summary: 'Solicita una excepción',
          description:
            'Siempre nace Pendiente: nada se exceptúa sin aprobación humana. La ' +
            'severidad la decide el control, no quien la solicita.',
          tags: ['excepciones'],
          body: NuevaExcepcion,
          response: { ...respuestasAuth, 201: Excepcion, 422: ErrorValidacion },
        },
      },
      async (peticion, respuesta) => {
        const motivos = validarSolicitud(
          peticion.body,
          new Set(catalogo.controles.map((c) => c.codigo)),
        )
        if (motivos.length > 0) {
          return respuesta.code(422).send({
            error: 'La solicitud no cumple las reglas de excepción',
            motivos,
          })
        }

        const solicitante = actor(peticion)
        const guardada = await repositorio.crear({
          control: peticion.body.control,
          recurso: peticion.body.recurso,
          ambiente: peticion.body.ambiente,
          justificacion: peticion.body.justificacion.trim(),
          solicitadaPor: solicitante.nombre,
          solicitanteSujeto: solicitante.sujeto,
          aprobadorSolicitado: peticion.body.aprobador.trim(),
          // A quién se le pide no es quién aprobó: aún nadie lo hizo.
          aprobadaPor: null,
          solicitadaEn: new Date().toISOString(),
          venceEl: peticion.body.venceEl,
          planRemediacion: peticion.body.planRemediacion?.trim() || null,
        })
        return respuesta.code(201).send(completar(guardada, await hallazgosAbiertos()))
      },
    )

    app.get(
      '/excepciones/:id',
      {
        onRequest: requiere('leer'),
        schema: {
          summary: 'Una excepción por identificador',
          description:
            'Con el control completado desde el catálogo y el estado derivado de la fecha, ' +
            'igual que en la lista.',
          tags: ['excepciones'],
          params: ParametrosId,
          response: { ...respuestasAuth, 200: Excepcion, 404: ErrorRespuesta },
        },
      },
      async (peticion, respuesta) => {
        const guardada = await repositorio.obtener(peticion.params.id)
        if (guardada === null) {
          return respuesta.code(404).send({ error: 'No existe esa excepción' })
        }
        return completar(guardada, await hallazgosAbiertos())
      },
    )

    // POST y no PATCH, a propósito: aprobar y rechazar son acciones con reglas
    // (estado, segregación de funciones, fundamento), no ediciones de un campo.
    // Un PATCH sobre `estado` invitaría a saltarse esas reglas.
    app.post(
      '/excepciones/:id/aprobar',
      {
        onRequest: requiere('decidirExcepcion'),
        schema: {
          summary: 'Aprueba una excepción',
          description:
            'Solo una excepción pendiente y vigente se puede decidir; si ya se decidió o ' +
            'venció responde 409. Quien la solicitó no puede aprobarla y el comentario es ' +
            'obligatorio (422). Aprobar no cambia la vigencia: la acotó la solicitud.',
          tags: ['excepciones'],
          params: ParametrosId,
          body: CuerpoDecision,
          response: respuestasDecision,
        },
      },
      async (peticion, respuesta) => {
        const { codigo, cuerpo } = await decidir(
          peticion.params.id,
          'Activa',
          actor(peticion),
          peticion.body.comentario,
        )
        return respuesta.code(codigo).send(cuerpo)
      },
    )

    app.post(
      '/excepciones/:id/rechazar',
      {
        onRequest: requiere('decidirExcepcion'),
        schema: {
          summary: 'Rechaza una excepción',
          description:
            'Mismas reglas que aprobar: solo una pendiente y vigente (409), nadie decide su ' +
            'propia solicitud y el rechazo también exige fundamento (422).',
          tags: ['excepciones'],
          params: ParametrosId,
          body: CuerpoDecision,
          response: respuestasDecision,
        },
      },
      async (peticion, respuesta) => {
        const { codigo, cuerpo } = await decidir(
          peticion.params.id,
          'Rechazada',
          actor(peticion),
          peticion.body.comentario,
        )
        return respuesta.code(codigo).send(cuerpo)
      },
    )

    app.post(
      '/excepciones/:id/revocar',
      {
        onRequest: requiere('revocarExcepcion'),
        schema: {
          summary: 'Revoca una excepción activa',
          description:
            'Solo Compliance Lead. Solo una excepción activa y vigente (409): una pendiente ' +
            'se rechaza y una vencida ya no protege nada. El motivo es obligatorio (422). ' +
            'Al revocarla, los hallazgos que cubría vuelven a su estado sin que nadie los ' +
            'toque, y quien la aprobó se conserva.',
          tags: ['excepciones'],
          params: ParametrosId,
          body: CuerpoDecision,
          response: respuestasDecision,
        },
      },
      async (peticion, respuesta) => {
        const guardada = await repositorio.obtener(peticion.params.id)
        if (guardada === null) {
          return respuesta.code(404).send({ error: 'No existe esa excepción' })
        }
        const { conflicto, motivos } = validarRevocacion(guardada, peticion.body.comentario)
        if (conflicto !== null) return respuesta.code(409).send({ error: conflicto })
        if (motivos.length > 0) {
          return respuesta.code(422).send({ error: 'La revocación no cumple las reglas', motivos })
        }

        const quien = actor(peticion)
        const revocada = await repositorio.revocar(guardada.id, {
          revocadaPor: quien.nombre,
          motivo: peticion.body.comentario.trim(),
          revocadaEn: new Date().toISOString(),
        })
        if (revocada === null) {
          return respuesta.code(404).send({ error: 'No existe esa excepción' })
        }
        await evidencia.registrar({
          tipo: 'excepcion.revocada',
          objetoId: revocada.id,
          actor: quien.nombre,
          detalle: {
            codigo: revocada.codigo,
            comentario: revocada.motivoRevocacion ?? '',
            sujeto: quien.sujeto,
          },
        })
        return completar(revocada, await hallazgosAbiertos())
      },
    )
  }
}
