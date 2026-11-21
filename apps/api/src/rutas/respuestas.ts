import { Error as ErrorRespuesta } from '../model/esquemas.ts'

/**
 * Lo que responde una ruta que escribe evidencia cuando el bucket no la
 * acepta. Se declara en cada una para que el 503 salga en el OpenAPI y el
 * cliente sepa que puede reintentar: el cambio no se aplicó.
 */
export const respuestaSinEvidencia = { 503: ErrorRespuesta } as const
