FROM node:22-slim AS base

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY web/package.json ./web/

RUN npm ci

COPY src ./src
COPY data ./data
COPY web ./web

ARG MADGRADES_DB_URL
ARG MADGRADES_DB_SOURCE_PATH
ENV MADGRADES_DB_URL=${MADGRADES_DB_URL}
ENV MADGRADES_DB_SOURCE_PATH=${MADGRADES_DB_SOURCE_PATH}
ENV MADGRADES_DB_PATH=/app/web/data/fall-2026.sqlite

RUN rm -f web/data/fall-2026.sqlite && node web/scripts/download-db.mjs
RUN npm run build --workspace=web

FROM node:22-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV MADGRADES_DB_PATH=/app/web/data/fall-2026.sqlite

COPY --from=base /app/package.json /app/package-lock.json ./
COPY --from=base /app/web/package.json ./web/
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/web/node_modules ./web/node_modules

COPY --from=base /app/web/.next ./web/.next
COPY --from=base /app/web/public ./web/public
COPY --from=base /app/web/data ./web/data

EXPOSE 3000

CMD ["npm", "run", "start", "--workspace=web"]
