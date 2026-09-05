FROM oven/bun:1.4.1-slim AS base
WORKDIR /usr/src/app
EXPOSE 3000

FROM base AS builder
ENV NODE_ENV=production
COPY package.json bun.lock ./
RUN bun i --frozen-lockfile
COPY . .
ARG APP_VERSION
ENV APP_VERSION=$APP_VERSION
RUN bun run build

FROM base AS prod-deps
COPY package.json bun.lock ./
RUN bun i --frozen-lockfile --production

FROM base
RUN mkdir -p data && chown bun:bun data
USER bun
COPY --from=prod-deps --chown=bun:bun /usr/src/app/node_modules ./node_modules
COPY --from=builder   --chown=bun:bun /usr/src/app/package.json ./package.json
COPY --from=builder   --chown=bun:bun /usr/src/app/build ./build
CMD [ "bun", "build/index.js" ]
