import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requiere, respuestasAuth } from '../auth/autorizacion.ts'
import {
  Error as ErrorRespuesta,
  Excepcion,
  FiltroExcepciones,
  NuevaExcepcion,
} from '../model/esquemas.ts'
import {
  estadoVigente,
  validarDecision,
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

// Quien decide viene en el cuerpo porque aún no hay autenticación. Cuando
// exista OIDC (ver «Autenticación» en el README) saldrá del token: si el
// cliente pudiera declararlo, cualquiera aprobaría a nombre del aprobador.
// El comentario no lleva mínimo aquí para que la regla responda 422 con
// `motivos`, igual que el resto de las reglas, y no un 400 genérico de Zod.
const CuerpoAprobar = z.object({
  aprobadaPor: z.string().min(1).describe('Quién aprueba; saldrá del token con OIDC'),
  comentario: z.string().describe('Fundamento de la decisión'),
})

const CuerpoRechazar = z.object({
  rechazadaPor: z.string().min(1).describe('Quién rechaza; saldrá del token con OIDC'),
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
  evidencia: EvidenciaRepositorio,
): FastifyPluginAsyncZod {
  /**
   * Completa la excepción con los datos del control y su estado vigente.
   * El nombre, el marco y la severidad no se guardan: se toman del catálogo
   * al leer, para que una excepción no congele una descripción obsoleta.
   */
  const completar = (guardada: ExcepcionGuardada): z.infer<typeof Excepcion> => {
    const control = catalogo.controles.find((c) => c.codigo === guardada.control)
    const { estadoGuardado, ...resto } = guardada
    return {
      ...resto,
      controlNombre: control?.titulo ?? 'Control desconocido',
      marco: control?.mapeo[0]?.marco ?? '—',
      severidad: control?.severidad ?? 'Media',
      estado: estadoVigente(estadoGuardado, guardada.venceEl),
    }
  }

  /**
   * Aplica una decisión y devuelve el código y el cuerpo a responder.
   * Aprobar y rechazar comparten las reglas; solo cambia el estado destino.
   */
  const decidir = async (
    id: string,
    estado: Decision['estado'],
    decididaPor: string,
    comentario: string,
  ) => {
    const guardada = await repositorio.obtener(id)
    if (guardada === null) {
      return { codigo: 404 as const, cuerpo: { error: 'No existe esa excepción' } }
    }

    const { conflicto, motivos } = validarDecision(guardada, { decididaPor, comentario })
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
      decididaPor: decididaPor.trim(),
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
      actor: decidida.aprobadaPor ?? decididaPor.trim(),
      detalle: { codigo: decidida.codigo, comentario: decidida.comentarioDecision ?? '' },
    })
    return { codigo: 200 as const, cuerpo: completar(decidida) }
  }

  return async (app) => {
    app.get(
      '/excepciones',
      {
        preHandler: requiere('leer'),
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
        excepciones: (await repositorio.listar(peticion.query)).map(completar),
      }),
    )

    app.post(
      '/excepciones',
      {
        preHandler: requiere('solicitarExcepcion'),
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

        const guardada = await repositorio.crear({
          control: peticion.body.control,
          recurso: peticion.body.recurso,
          ambiente: peticion.body.ambiente,
          justificacion: peticion.body.justificacion.trim(),
          // Del cuerpo mientras no haya OIDC; después, del token.
          solicitadaPor: peticion.body.solicitante.trim(),
          aprobadorSolicitado: peticion.body.aprobador.trim(),
          // A quién se le pide no es quién aprobó: aún nadie lo hizo.
          aprobadaPor: null,
          solicitadaEn: new Date().toISOString(),
          venceEl: peticion.body.venceEl,
          planRemediacion: peticion.body.planRemediacion?.trim() || null,
        })
        return respuesta.code(201).send(completar(guardada))
      },
    )

    app.get(
      '/excepciones/:id',
      {
        preHandler: requiere('leer'),
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
        return completar(guardada)
      },
    )

    // POST y no PATCH, a propósito: aprobar y rechazar son acciones con reglas
    // (estado, segregación de funciones, fundamento), no ediciones de un campo.
    // Un PATCH sobre `estado` invitaría a saltarse esas reglas.
    app.post(
      '/excepciones/:id/aprobar',
      {
        preHandler: requiere('decidirExcepcion'),
        schema: {
          summary: 'Aprueba una excepción',
          description:
            'Solo una excepción pendiente y vigente se puede decidir; si ya se decidió o ' +
            'venció responde 409. Quien la solicitó no puede aprobarla y el comentario es ' +
            'obligatorio (422). Aprobar no cambia la vigencia: la acotó la solicitud.',
          tags: ['excepciones'],
          params: ParametrosId,
          body: CuerpoAprobar,
          response: respuestasDecision,
        },
      },
      async (peticion, respuesta) => {
        const { codigo, cuerpo } = await decidir(
          peticion.params.id,
          'Activa',
          peticion.body.aprobadaPor,
          peticion.body.comentario,
        )
        return respuesta.code(codigo).send(cuerpo)
      },
    )

    app.post(
      '/excepciones/:id/rechazar',
      {
        preHandler: requiere('decidirExcepcion'),
        schema: {
          summary: 'Rechaza una excepción',
          description:
            'Mismas reglas que aprobar: solo una pendiente y vigente (409), nadie decide su ' +
            'propia solicitud y el rechazo también exige fundamento (422).',
          tags: ['excepciones'],
          params: ParametrosId,
          body: CuerpoRechazar,
          response: respuestasDecision,
        },
      },
      async (peticion, respuesta) => {
        const { codigo, cuerpo } = await decidir(
          peticion.params.id,
          'Rechazada',
          peticion.body.rechazadaPor,
          peticion.body.comentario,
        )
        return respuesta.code(codigo).send(cuerpo)
      },
    )
  }
}
