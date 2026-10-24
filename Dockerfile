FROM oven/bun:1.4.4-slim AS base
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
# 実行の段にはシェルが無いので、PVC を被せる data/ はここで作って持ち主ごと写す
RUN mkdir -p /out/data

# 依存は全部 devDependencies にしてあるので vite が build/ に取り込む。
# 実行時に要るのは build/ だけで、node_modules は入れない。
# 実行はシェルもパッケージマネージャも無い distroless の Bun (glibc・CA 証明書・tzdata は入っている)。
# uid は slim の bun ユーザーと同じ 1000:1000 のままにして、今の PVC をそのまま書けるようにする
FROM oven/bun:1.4.4-distroless
WORKDIR /usr/src/app
EXPOSE 3000
USER 1000:1000
COPY --from=builder --chown=1000:1000 /out/ ./
COPY --from=builder --chown=1000:1000 /usr/src/app/package.json ./package.json
COPY --from=builder --chown=1000:1000 /usr/src/app/build ./build
# エントリポイントは bun そのもの (元のイメージもそう)。CMD は引数だけにするため明示する
ENTRYPOINT ["/usr/local/bin/bun"]
CMD ["./build"]
