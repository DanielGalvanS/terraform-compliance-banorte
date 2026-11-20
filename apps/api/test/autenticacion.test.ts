import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { construirApp, PREFIJO } from '../src/app.ts'
import { emitirTokenLocal, verificadorJwks, verificadorLocal } from '../src/auth/verificador.ts'
import { cargarConfig } from '../src/config.ts'
import { configDePrueba, conToken, SECRETO_PRUEBAS, tokenDe, USUARIOS } from './auth.ts'

describe('verificador local', () => {
  const verificador = verificadorLocal(SECRETO_PRUEBAS)

  it('acepta un token propio y devuelve la identidad', async () => {
    expect(await verificador.verificar(await tokenDe(USUARIOS.aprobador))).toEqual(
      USUARIOS.aprobador,
    )
  })

  it('rechaza un token firmado con otro secreto', async () => {
    const ajeno = await emitirTokenLocal('otro-'.repeat(8), USUARIOS.lead)
    expect(await verificador.verificar(ajeno)).toBeNull()
  })

  it('rechaza un token vencido', async () => {
    expect(await verificador.verificar(await tokenDe(USUARIOS.lead, '-1m'))).toBeNull()
  })

  it('rechaza un token con un rol que no existe', async () => {
    const token = await emitirTokenLocal(SECRETO_PRUEBAS, {
      ...USUARIOS.lead,
      rol: 'Administrador' as 'Auditor',
    })
    expect(await verificador.verificar(token)).toBeNull()
  })

  it('rechaza basura', async () => {
    expect(await verificador.verificar('no-es-un-jwt')).toBeNull()
  })
})

describe('verificador jwks', () => {
  let servidor: Server
  let url: string
  let privateKey: CryptoKey

  beforeAll(async () => {
    const par = await generateKeyPair('RS256')
    privateKey = par.privateKey
    const publicKey = par.publicKey
    const jwk = { ...(await exportJWK(publicKey)), kid: 'llave-1', alg: 'RS256' }
    servidor = createServer((_, respuesta) => {
      respuesta.setHeader('content-type', 'application/json')
      respuesta.end(JSON.stringify({ keys: [jwk] }))
    })
    await new Promise<void>((listo) => servidor.listen(0, '127.0.0.1', listo))
    url = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/jwks`
  })

  afterAll(() => servidor.close())

  const firmar = (claims: Record<string, string>, emisor = 'https://idp.ejemplo') =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: 'llave-1' })
      .setSubject('roberto.silva')
      .setIssuer(emisor)
      .setAudience('compliance-ops-api')
      .setExpirationTime('5m')
      .sign(privateKey)

  const verificador = () =>
    verificadorJwks({ url, emisor: 'https://idp.ejemplo', audiencia: 'compliance-ops-api' })

  it('acepta un token del proveedor con rol', async () => {
    const token = await firmar({ name: 'Roberto Silva', rol: 'Aprobador' })
    expect(await verificador().verificar(token)).toEqual(USUARIOS.aprobador)
  })

  it('sin claim de rol no hay identidad', async () => {
    expect(await verificador().verificar(await firmar({ name: 'Roberto Silva' }))).toBeNull()
  })

  it('rechaza otro emisor', async () => {
    const token = await firmar({ name: 'Roberto Silva', rol: 'Aprobador' }, 'https://otro.idp')
    expect(await verificador().verificar(token)).toBeNull()
  })
})

describe('configuración de autenticación', () => {
  it('el modo local no arranca con base de datos real', () => {
    expect(() => cargarConfig({ DATABASE_URL: 'postgres://localhost/x' })).toThrow(/modo local/)
  })

  it('el modo jwks exige url, emisor y audiencia', () => {
    expect(() => cargarConfig({ AUTH_MODO: 'jwks' })).toThrow(/AUTH_JWKS_URL/)
  })

  it('un secreto corto no se acepta', () => {
    expect(() => cargarConfig({ AUTH_SECRETO: 'corto' })).toThrow(/32/)
  })
})

describe('rutas protegidas', () => {
  let app: Awaited<ReturnType<typeof construirApp>>

  beforeAll(async () => {
    app = await construirApp({ config: configDePrueba() })
    await app.ready()
  })

  const PENDIENTE = '/excepciones?estado=Pendiente'

  it('sin token responde 401', async () => {
    const r = await app.inject({ method: 'GET', url: `${PREFIJO}/hallazgos` })
    expect(r.statusCode).toBe(401)
  })

  it('con un token inválido responde 401', async () => {
    const r = await app.inject(
      conToken({ method: 'GET', url: `${PREFIJO}/hallazgos` }, 'no-es-un-jwt'),
    )
    expect(r.statusCode).toBe(401)
  })

  it('con un token vencido responde 401', async () => {
    const vencido = await tokenDe(USUARIOS.lead, '-1m')
    const r = await app.inject(conToken({ method: 'GET', url: `${PREFIJO}/hallazgos` }, vencido))
    expect(r.statusCode).toBe(401)
  })

  it('el Auditor puede leer', async () => {
    const r = await app.inject(
      conToken({ method: 'GET', url: `${PREFIJO}/evidencia` }, await tokenDe(USUARIOS.auditor)),
    )
    expect(r.statusCode).toBe(200)
  })

  it.each([
    ['Auditor', USUARIOS.auditor],
    ['Desarrollador', USUARIOS.desarrollador],
    ['Agente', USUARIOS.agente],
  ])('el %s no puede aprobar una excepción (403)', async (_, identidad) => {
    const pendiente = (
      await app.inject(conToken({ method: 'GET', url: `${PREFIJO}${PENDIENTE}` }))
    ).json().excepciones[0]
    const r = await app.inject(
      conToken(
        {
          method: 'POST',
          url: `${PREFIJO}/excepciones/${pendiente.id}/aprobar`,
          payload: { comentario: 'Riesgo aceptado por la ventana' },
        },
        await tokenDe(identidad),
      ),
    )
    expect(r.statusCode).toBe(403)
  })

  it('el Auditor no puede cambiar el estado de un hallazgo (403)', async () => {
    const hallazgo = (
      await app.inject(conToken({ method: 'GET', url: `${PREFIJO}/hallazgos?estado=Abierto` }))
    ).json().hallazgos[0]
    const r = await app.inject(
      conToken(
        {
          method: 'PATCH',
          url: `${PREFIJO}/hallazgos/${hallazgo.id}/estado`,
          payload: { estado: 'Cerrado', comentario: 'Corregido en el PR' },
        },
        await tokenDe(USUARIOS.auditor),
      ),
    )
    expect(r.statusCode).toBe(403)
  })

  it('/salud es pública', async () => {
    expect((await app.inject({ method: 'GET', url: '/salud' })).statusCode).toBe(200)
  })

  it('el navegador puede mandar el token: CORS permite authorization', async () => {
    const r = await app.inject({
      method: 'OPTIONS',
      url: `${PREFIJO}/hallazgos`,
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'authorization',
      },
    })
    expect(r.headers['access-control-allow-headers']).toContain('authorization')
  })
})

describe('sesión de demostración', () => {
  let app: Awaited<ReturnType<typeof construirApp>>

  beforeAll(async () => {
    app = await construirApp({ config: configDePrueba() })
    await app.ready()
  })

  const entrar = (email: string, password = 'demo') =>
    app.inject({ method: 'POST', url: `${PREFIJO}/sesion`, payload: { email, password } })

  it('entrega un token con el rol del usuario y sus permisos', async () => {
    const r = await entrar('roberto.silva@banco.mx')
    expect(r.statusCode).toBe(200)
    expect(r.json().usuario).toMatchObject({ nombre: 'Roberto Silva', rol: 'Aprobador' })
    expect(r.json().permisos).toContain('decidirExcepcion')
    expect(r.json().permisos).not.toContain('solicitarExcepcion')
  })

  it('el token sirve contra la API con los permisos de su rol', async () => {
    const auditora = (await entrar('lucia.ramos@banco.mx')).json().token
    const leer = await app.inject(conToken({ method: 'GET', url: `${PREFIJO}/hallazgos` }, auditora))
    expect(leer.statusCode).toBe(200)
    const solicitar = await app.inject(
      conToken({ method: 'POST', url: `${PREFIJO}/excepciones`, payload: {} }, auditora),
    )
    expect(solicitar.statusCode).toBe(403)
  })

  it('ignora mayúsculas y espacios en el correo', async () => {
    expect((await entrar('  Ana.Martinez@Banco.MX ')).statusCode).toBe(200)
  })

  it('una contraseña incorrecta responde 401', async () => {
    expect((await entrar('ana.martinez@banco.mx', 'otra')).statusCode).toBe(401)
  })

  it('un correo desconocido responde 401 con el mismo mensaje', async () => {
    const desconocido = await entrar('nadie@banco.mx')
    const malaContrasena = await entrar('ana.martinez@banco.mx', 'otra')
    expect(desconocido.statusCode).toBe(401)
    expect(desconocido.json().error).toBe(malaContrasena.json().error)
  })

  it('con un proveedor de identidad la ruta no existe', async () => {
    const jwks = await construirApp({
      config: configDePrueba({
        AUTH_MODO: 'jwks',
        AUTH_JWKS_URL: 'https://idp.ejemplo/jwks',
        AUTH_EMISOR: 'https://idp.ejemplo',
        AUTH_AUDIENCIA: 'compliance-ops-api',
      }),
    })
    const r = await jwks.inject({
      method: 'POST',
      url: `${PREFIJO}/sesion`,
      payload: { email: 'ana.martinez@banco.mx', password: 'demo' },
    })
    expect(r.statusCode).toBe(404)
    await jwks.close()
  })
})
