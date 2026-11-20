import type { InjectOptions } from 'fastify'
import { emitirTokenLocal } from '../src/auth/verificador.ts'
import { cargarConfig } from '../src/config.ts'
import type { Identidad } from '../src/model/esquemas.ts'

/**
 * Ayudas de autenticación para las pruebas.
 *
 * El secreto se arma al vuelo y es obvio a propósito: no protege nada, y una
 * cadena con aspecto de llave real haría saltar el escáner de secretos.
 */
export const SECRETO_PRUEBAS = 'pruebas-'.repeat(5)

export const configDePrueba = (extra: Record<string, string> = {}) =>
  cargarConfig({ NIVEL_LOG: 'fatal', AUTH_SECRETO: SECRETO_PRUEBAS, ...extra })

export const USUARIOS = {
  lead: { sujeto: 'ana.martinez', nombre: 'Ana Martínez', rol: 'Compliance Lead' },
  aprobador: { sujeto: 'roberto.silva', nombre: 'Roberto Silva', rol: 'Aprobador' },
  desarrollador: { sujeto: 'carlos.vega', nombre: 'Carlos Vega', rol: 'Desarrollador' },
  auditor: { sujeto: 'lucia.ramos', nombre: 'Lucía Ramos', rol: 'Auditor' },
  agente: { sujeto: 'app-agente', nombre: 'Agente de cumplimiento', rol: 'Agente' },
  pipeline: { sujeto: 'ci-plan', nombre: 'Pipeline', rol: 'Pipeline' },
} satisfies Record<string, Identidad>

export const tokenDe = (identidad: Identidad, duracion?: string) =>
  emitirTokenLocal(SECRETO_PRUEBAS, identidad, duracion)

export const TOKEN_LEAD = await tokenDe(USUARIOS.lead)

/** Agrega el token a una petición de `inject`, sin pisar otras cabeceras. */
export function conToken(opciones: InjectOptions, token: string = TOKEN_LEAD): InjectOptions {
  return {
    ...opciones,
    headers: { authorization: `Bearer ${token}`, ...opciones.headers },
  }
}
