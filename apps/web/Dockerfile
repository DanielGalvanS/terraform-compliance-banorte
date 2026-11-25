# Imagen del frontend para Cloud Run: el build de Vite servido por nginx.
#
# Se construye desde la raíz del repositorio:
#
#   docker build -f apps/web/Dockerfile --build-arg VITE_API_URL=https://... -t web .
#
# VITE_API_URL queda escrita en el JavaScript al compilar; cambiarla exige otra
# imagen. Sin ella el frontend usa sus datos de ejemplo, como en desarrollo.
#
# Las bases van fijadas por digest además de por etiqueta (ver apps/api/Dockerfile).

FROM node:22-slim@sha256:be979e5523c76fa4d5ca4ebd3099078f220aa47ec39c48ad5b5df9314debd6eb AS compilacion
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace compliance-ops-web --ignore-scripts
COPY apps/web apps/web
ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build --workspace compliance-ops-web

# nginx sin privilegios: corre como usuario 101 y escucha en 8080, el puerto
# que espera Cloud Run.
FROM nginxinc/nginx-unprivileged:1.29-alpine@sha256:0c79d56aee561a1d81c63f00eee5fb5fe29279560cdc55e91425133104c7fbe6
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/web/cabeceras.inc /etc/nginx/conf.d/cabeceras.inc
COPY --from=compilacion /app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
