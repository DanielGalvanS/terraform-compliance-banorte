# Imagen de la API de cumplimiento para Cloud Run.
#
# Se construye desde la raíz del repositorio, porque necesita el lockfile del
# monorepo y el catálogo de controles:
#
#   docker build -f apps/api/Dockerfile -t api .
#
# La base va fijada por digest además de por etiqueta: la etiqueta se puede
# mover, el digest no. Para actualizarla, `docker pull node:22-slim` y copiar
# el digest nuevo.

FROM node:22-slim@sha256:be979e5523c76fa4d5ca4ebd3099078f220aa47ec39c48ad5b5df9314debd6eb AS dependencias
WORKDIR /app
# Los package.json de todos los workspaces: `npm ci` compara el lockfile con
# todos, aunque aquí solo se instale la API.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @compliance-ops/api --omit=dev --ignore-scripts

FROM node:22-slim@sha256:be979e5523c76fa4d5ca4ebd3099078f220aa47ec39c48ad5b5df9314debd6eb
WORKDIR /app
ENV NODE_ENV=production \
    # Cloud Run entrega el tráfico por esta interfaz; con el 127.0.0.1 de
    # desarrollo la API no recibiría nada.
    HOST=0.0.0.0 \
    PUERTO=8080 \
    # El mismo catálogo que evalúa la compuerta, copiado abajo.
    RUTA_CATALOGO=/app/infra/policies/mappings.yaml

# Los archivos quedan de root y el proceso corre como node: puede leerlos, no
# cambiarlos. Cloud Run no monta el disco en solo lectura, así que esto es lo
# que impide que una dependencia comprometida reescriba el código o el catálogo.
COPY --from=dependencias /app/node_modules ./node_modules
COPY apps/api/package.json apps/api/
COPY apps/api/src apps/api/src
COPY infra/policies/mappings.yaml infra/policies/mappings.yaml

USER node
WORKDIR /app/apps/api
EXPOSE 8080
# node directo, sin npm: así SIGTERM llega al proceso y la API cierra en orden
# (main.ts) cuando Cloud Run recicla la instancia.
CMD ["node", "--experimental-strip-types", "--no-warnings=ExperimentalWarning", "src/main.ts"]
