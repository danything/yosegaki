FROM oven/bun:1.4.2-slim AS base
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

# 依存は全部 devDependencies にしてあるので vite が build/ に取り込む。
# 実行時に要るのは build/ だけで、node_modules は入れない
FROM base
RUN mkdir -p data && chown bun:bun data
USER bun
COPY --from=builder --chown=bun:bun /usr/src/app/package.json ./package.json
COPY --from=builder --chown=bun:bun /usr/src/app/build ./build
CMD [ "bun", "build/index.js" ]
