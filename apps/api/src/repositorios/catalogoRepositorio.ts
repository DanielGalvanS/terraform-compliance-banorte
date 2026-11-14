import { readFile } from 'node:fs/promises'
import { parse } from 'yaml'
import { z } from 'zod'
import type { Control, Marco } from '../model/esquemas.ts'
import { Severidad } from '../model/esquemas.ts'

/**
 * El catálogo de controles se lee de `infra/policies/mappings.yaml`, el mismo
 * archivo que usa la compuerta.
 *
 * Tenerlo duplicado en la base sería más cómodo de consultar y acabaría
 * discrepando: la API mostraría controles que ya no bloquean, o al revés. La
 * fuente de verdad es el archivo que firma Cumplimiento en el Gate 1.
 */

const severidadArchivo = z.enum(['critica', 'alta', 'media', 'baja'])

/** El YAML escribe la severidad en minúsculas y sin acento. */
const SEVERIDADES: Record<z.infer<typeof severidadArchivo>, z.infer<typeof Severidad>> = {
  critica: 'Crítica',
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
}

const referenciaArchivo = z.object({
  referencia: z.string(),
  titulo: z.string(),
  por_validar: z.boolean().optional(),
})

const archivo = z.object({
  version_catalogo: z.string(),
  etiquetas_obligatorias: z.array(z.string()).min(1),
  tipos_etiquetables: z.array(z.string()).min(1),
  marcos: z.record(
    z.string(),
    z.object({
      nombre: z.string(),
      nombre_corto: z.string(),
      version: z.string().optional(),
      ambito: z.string().optional(),
    }),
  ),
  controles: z.array(
    z.object({
      id: z.string(),
      titulo: z.string(),
      descripcion: z.string(),
      severidad: severidadArchivo,
      caso_de_prueba: z.string().optional(),
      mapeo: z.record(z.string(), z.array(referenciaArchivo)),
    }),
  ),
})

export type Catalogo = {
  version: string
  /** Claves que exige CO-TAG-01; la API deriva de ellas el estado de un recurso. */
  etiquetasObligatorias: string[]
  /** Tipos que admiten etiquetas en GCP; al resto no se les exigen. */
  tiposEtiquetables: string[]
  marcos: Marco[]
  controles: Control[]
}

export async function cargarCatalogo(ruta: string): Promise<Catalogo> {
  let crudo: unknown
  try {
    crudo = parse(await readFile(ruta, 'utf8'))
  } catch (causa) {
    throw new Error(`No se pudo leer el catálogo en ${ruta}`, { cause: causa })
  }

  const resultado = archivo.safeParse(crudo)
  if (!resultado.success) {
    const detalle = resultado.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(`El catálogo no tiene la forma esperada:\n${detalle}`)
  }

  const datos = resultado.data
  const nombreCortoDe = (clave: string) => datos.marcos[clave]?.nombre_corto ?? clave

  return {
    version: datos.version_catalogo,
    etiquetasObligatorias: datos.etiquetas_obligatorias,
    tiposEtiquetables: datos.tipos_etiquetables,
    marcos: Object.entries(datos.marcos).map(([clave, marco]) => ({
      clave,
      nombre: marco.nombre,
      nombreCorto: marco.nombre_corto,
      ...(marco.version === undefined ? {} : { version: marco.version }),
      ...(marco.ambito === undefined ? {} : { ambito: marco.ambito }),
    })),
    controles: datos.controles.map((control) => ({
      codigo: control.id,
      titulo: control.titulo,
      descripcion: control.descripcion,
      severidad: SEVERIDADES[control.severidad],
      ...(control.caso_de_prueba === undefined ? {} : { casoDePrueba: control.caso_de_prueba }),
      mapeo: Object.entries(control.mapeo).flatMap(([clave, referencias]) =>
        referencias.map((referencia) => ({
          marco: nombreCortoDe(clave),
          referencia: referencia.referencia,
          titulo: referencia.titulo,
          porValidar: referencia.por_validar ?? false,
        })),
      ),
    })),
  }
}
