# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=24.12.0

FROM node:${NODE_VERSION}-bookworm-slim AS workspace

ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}

RUN apt-get update \
    && apt-get install --no-install-recommends -y ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/shared-schemas/package.json packages/shared-schemas/package.json

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @optime/api...

FROM workspace AS build

COPY apps/api apps/api
COPY packages/shared-types packages/shared-types
COPY packages/shared-schemas packages/shared-schemas

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter @optime/shared-types build \
    && pnpm --filter @optime/api prisma:generate \
    && pnpm --filter @optime/api build \
    && pnpm --filter @optime/api deploy --prod /optime-api \
    && cd /optime-api \
    && /workspace/apps/api/node_modules/.bin/prisma generate --schema=prisma/schema.prisma \
    && cp -R /workspace/packages/shared-types/dist /optime-api/node_modules/@optime/shared-types/dist \
    && cp /workspace/packages/shared-types/package.runtime.json /optime-api/node_modules/@optime/shared-types/package.json

# Run this target once per release before starting the new API image.
FROM build AS migrator

ENV NODE_ENV=production
WORKDIR /workspace/apps/api
USER node

CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]

FROM node:${NODE_VERSION}-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=3000

RUN apt-get update \
    && apt-get install --no-install-recommends -y ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=build --chown=node:node /optime-api ./

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "const port=process.env.PORT||3000;fetch(`http://127.0.0.1:${port}/v1/system/health/live`).then((response)=>{if(!response.ok)process.exit(1)}).catch(()=>process.exit(1))"]

CMD ["node", "dist/main.js"]
