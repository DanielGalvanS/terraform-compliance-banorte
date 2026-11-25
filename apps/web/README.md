# Compliance Ops

Prototipo web de gobierno de infraestructura: valida cada cambio de Terraform,
registra hallazgos y conserva evidencia auditable.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + bundle de producción
npm run typecheck
```

## Arquitectura

El código se organiza en tres capas con una sola dirección de dependencia:

```
app  →  features  →  shared
```

- **`src/app`** — composición: proveedores globales, el shell (sidebar y barra
  superior) y el registro de rutas. Es la única capa que conoce todas las
  funcionalidades.
- **`src/features/<nombre>`** — una carpeta por área del producto, autocontenida:
  - `model/` tipos del dominio y reglas puras (vigencias, validación, tonos).
  - `data/` fixtures: los datos de demostración, y nada más.
  - `api/` el repositorio: el único punto que lee `data/`. Sustituir estas
    funciones por llamadas HTTP es todo lo que hace falta para conectar un
    backend real.
  - `components/` la página y sus piezas visuales.
  - `hooks/` estado propio de la funcionalidad.
  - `index.ts` la superficie pública; nadie importa el interior de otra feature.
- **`src/shared`** — lo reutilizable y sin dominio: `ui/` (botones, tarjetas,
  tablas, drawer, modal…), `hooks/`, `navigation/`, `lib/` y `model/` con el
  vocabulario común (ambiente, severidad, tono).

Reglas que sostienen la estructura:

1. **Los componentes no importan fixtures.** Siempre pasan por el repositorio.
2. **Los datos describen hechos, no estilos.** Un hallazgo guarda su severidad;
   el color se deriva con `severityTone()`. Así un cambio de paleta no toca los
   datos.
3. **Las reglas de negocio son funciones puras** (`model/expiry.ts`,
   `model/validation.ts`, `model/coverage.ts`), testeables sin React.
4. **Una ruta nueva es una entrada en `app/routes/routes.tsx`.** El sidebar, el
   breadcrumb y el router leen de ahí.

### Navegación

`shared/navigation` implementa un router por hash (`#/findings`), sin
dependencias externas: las páginas son enlazables y el botón de retroceso
funciona. La capa `app` decide qué rutas existen.

### Estilos

`src/styles/index.css` importa los parciales en orden de cascada: tokens →
reset → componentes → features → breakpoints. El orden es significativo; un
archivo nuevo va en su capa, no al final. Los porcentajes que dependen de los
datos (barras, anillo de cobertura) se aplican como estilos en línea desde el
componente, no en el CSS.

### Datos de demostración

Los fixtures de excepciones calculan sus fechas a partir de hoy, de modo que
los estados «por vencer» y «vencida» siguen siendo correctos cada vez que se
abre el prototipo. Las estadísticas se derivan de las filas, por lo que nunca
contradicen la tabla.

## Autenticación

`features/auth` encapsula el acceso. `authRepository` acepta cualquier
credencial no vacía y devuelve la identidad de demostración: es el único
archivo que hay que cambiar para integrar el proveedor de identidad real.

## Imagen para Cloud Run

```bash
docker build -f apps/web/Dockerfile --build-arg VITE_API_URL=https://<url-de-la-api> -t cumplimiento-web .
docker run --rm -p 8080:8080 cumplimiento-web
```

El build de Vite servido por nginx sin privilegios en el puerto 8080.
`VITE_API_URL` se escribe en el JavaScript al compilar: otra API exige otra
imagen, y sin ella el frontend usa sus datos de ejemplo. La navegación va por
el hash (`#/hallazgos`), así que solo existe `/` y cualquier otra ruta responde
404. `index.html` se sirve sin caché y `/assets/` con caché de un año, porque
sus nombres cambian con cada versión. nginx comprime con gzip y añade las
cabeceras de `cabeceras.inc` a todas las respuestas.
