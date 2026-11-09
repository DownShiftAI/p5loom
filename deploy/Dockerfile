# Build the site with Node, serve it with nginx. Only the static output reaches the final image.
# Build from the repository root:  docker build -f deploy/Dockerfile -t p5loom-site:<tag> .

FROM docker.io/library/node:20-alpine AS build
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY site ./site
COPY scripts ./scripts
COPY examples ./examples
COPY schema ./schema
# No install: the build uses only node built-ins. The browser test is not run here.
RUN node scripts/build-docs.mjs --check && node scripts/build-docs.mjs --out /app/dist

FROM docker.io/nginxinc/nginx-unprivileged:1.27-alpine AS serve
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
USER 101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
