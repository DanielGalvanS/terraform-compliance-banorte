import type { Accion, Rol } from './esquemas.ts'

export type { Accion }

/**
 * Qué puede hacer cada rol.
 *
 * Es una tabla y no `if`s repartidos por las rutas para que se audite de un
 * vistazo y la documentación la copie tal cual. TypeScript exige una fila por
 * rol: agregar uno obliga a decidir sus permisos en vez de heredar alguno por
 * omisión.
 *
 * Dos ausencias son deliberadas:
 * - El Auditor solo lee. Si pudiera cambiar algo, ya no sería independiente
 *   de lo que audita.
 * - El Agente no decide excepciones ni cambia estados: registra su opinión y
 *   nada más. Las políticas deciden; la IA interpreta.
 */
export const PERMISOS: Record<Rol, readonly Accion[]> = {
  'Compliance Lead': [
    'leer',
    'solicitarExcepcion',
    'decidirExcepcion',
    'revocarExcepcion',
    'cambiarEstadoHallazgo',
    'registrarHallazgo',
  ],
  Aprobador: ['leer', 'decidirExcepcion', 'cambiarEstadoHallazgo'],
  Desarrollador: ['leer', 'solicitarExcepcion', 'cambiarEstadoHallazgo'],
  Auditor: ['leer'],
  Agente: ['leer', 'registrarDecision'],
  Pipeline: ['leer', 'registrarHallazgo'],
}

export function puede(rol: Rol, accion: Accion): boolean {
  return PERMISOS[rol].includes(accion)
}
