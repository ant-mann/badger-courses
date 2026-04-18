FROM node:22-slim AS base

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY web/package.json ./web/

RUN pnpm install --frozen-lockfile

COPY src ./src
COPY data/fall-2026.sqlite ./data/fall-2026.sqlite
COPY web ./web

# `next build` still needs a local SQLite file in the build stage.
ENV MADGRADES_DB_PATH=/app/data/fall-2026.sqlite

RUN pnpm --filter uw-madison-courses-web exec next build

FROM node:22-slim AS runner

WORKDIR /app
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=base /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=base /app/web/package.json ./web/
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/web/node_modules ./web/node_modules

COPY --from=base /app/web/.next ./web/.next
COPY --from=base /app/web/public ./web/public

EXPOSE 3000

CMD ["pnpm", "--filter", "uw-madison-courses-web", "run", "start"]
