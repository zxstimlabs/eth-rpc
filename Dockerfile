# syntax=docker/dockerfile:1
#
# Stages:
#   deps     — dependencies from bun.lock only (frozen; no re-resolution)
#   test     — source + deps; `bun test` (needs REDIS_URL, see deploy/compose.test.yaml)
#   build    — compiles the standalone binary
#   runtime  — the binary alone on distroless: non-root, no shell, no package manager
#
# No secrets are baked in: every *_RPC_URL and REDIS_URL is supplied at
# container start. The image is safe to publish.

ARG BUN_VERSION=1.4.5

FROM oven/bun:${BUN_VERSION} AS deps
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

FROM deps AS test
COPY tsconfig.json ./
COPY src ./src
CMD ["bun", "test"]

FROM test AS build
RUN bun build --compile --minify-whitespace --minify-syntax --target bun \
      --outfile /out/zxstim-rpc src/index.ts

FROM gcr.io/distroless/base-debian12:nonroot AS runtime
COPY --from=build /out/zxstim-rpc /zxstim-rpc
USER nonroot
EXPOSE 8000
ENTRYPOINT ["/zxstim-rpc"]
