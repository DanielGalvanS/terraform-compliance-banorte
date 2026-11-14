import { Badge } from './Badge'

/** De dónde salieron los datos que se están mostrando. */
export type Fuente = 'api' | 'ejemplo'

/**
 * Dice de dónde salieron los datos en pantalla.
 *
 * Mientras el prototipo conviva con la API real, confundir una cosa con la
 * otra es fácil y caro: alguien podría tomar un dato de ejemplo por la postura
 * real de producción.
 */
export function FuenteDeDatos({ fuente }: { fuente: Fuente }) {
  return fuente === 'api' ? (
    <Badge tone="success">Datos en vivo</Badge>
  ) : (
    <Badge tone="warning">Datos de ejemplo</Badge>
  )
}
