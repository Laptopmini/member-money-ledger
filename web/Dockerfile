# Dev image: deps are installed at build time, and the entrypoint re-runs `npm ci`
# only when package-lock.json changes (see docker-entrypoint.sh).
FROM node:26.13.1-alpine AS dev
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci && sha256sum package-lock.json | cut -d' ' -f1 > node_modules/.lockstamp
COPY docker-entrypoint.sh ./
EXPOSE 5173
ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]
CMD ["npm", "run", "dev"]

# Prod build: static bundle served by Caddy (Caddyfile is mounted from deploy/).
FROM node:26.13.1-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM caddy:2.11.9-alpine AS prod
COPY --from=build /app/dist /srv
EXPOSE 80
