import type { Control, NuevaDecisionAgente } from './esquemas.ts'
import type { MotivoRechazo } from './reglasExcepciones.ts'

/**
 * Comprueba que la decisión del agente sea coherente antes de registrarla.
 *
 * El agente ya impone estas reglas en su código (`apps/agent/agente/ejecutar.py`),
 * pero la API no confía en eso: el texto de la decisión lo escribe un modelo
 * que lee planes editables por cualquiera, y una decisión incoherente que
 * llegara a la evidencia sería peor que ninguna. Se acumulan todos los
 * motivos, no solo el primero.
 *
 * `excepcionActiva` responde si existe una excepción activa para el control y
 * el recurso. Es una función para que estas reglas sigan siendo puras.
 */
export function validarDecisionAgente(
  decision: NuevaDecisionAgente,
  severidadDe: (control: string) => Control['severidad'] | null,
  excepcionActiva: (control: string, recurso: string | null) => boolean,
): MotivoRechazo[] {
  const motivos: MotivoRechazo[] = []
  const { estado, resultadoCompuerta, clasificaciones } = decision

  // La compuerta decide; el estado del agente tiene que corresponder.
  if ((resultadoCompuerta === 'conforme') !== (estado === 'sin_violaciones')) {
    motivos.push({
      campo: 'estado',
      mensaje: 'Un veredicto conforme corresponde exactamente al estado sin_violaciones.',
    })
  }
  if (estado === 'analizado' && resultadoCompuerta !== 'bloqueado') {
    motivos.push({ campo: 'estado', mensaje: 'Solo se analiza un veredicto bloqueado.' })
  }
  if (estado === 'analizado' && clasificaciones.length === 0) {
    motivos.push({ campo: 'clasificaciones', mensaje: 'Un análisis sin clasificaciones no analizó nada.' })
  }
  if (estado !== 'analizado' && clasificaciones.length > 0) {
    motivos.push({ campo: 'clasificaciones', mensaje: `El estado ${estado} no lleva clasificaciones.` })
  }

  const vistas = new Set<string>()
  for (const [i, c] of clasificaciones.entries()) {
    const campo = `clasificaciones.${i}`
    if (vistas.has(c.violacion)) {
      motivos.push({ campo, mensaje: `La violación ${c.violacion} está repetida.` })
    }
    vistas.add(c.violacion)

    const severidad = severidadDe(c.control)
    if (severidad === null) {
      motivos.push({ campo, mensaje: `El control ${c.control} no existe en el catálogo.` })
    } else if (severidad !== c.severidad) {
      // La severidad la pone el catálogo. Si llega otra, alguien la cambió.
      motivos.push({
        campo,
        mensaje: `La severidad de ${c.control} es ${severidad}, no ${c.severidad}.`,
      })
    }

    // «Ninguna acción» solo se justifica con una excepción activa: si no, un
    // modelo manipulado podría dejar sin atender una violación real.
    if (c.accionSugerida === 'ninguna' && !excepcionActiva(c.control, c.recurso)) {
      motivos.push({
        campo,
        mensaje: `No hay una excepción activa que justifique no actuar sobre ${c.control}.`,
      })
    }
  }

  return motivos
}
