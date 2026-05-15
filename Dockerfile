####
# Sentinel — multi-stage build for the public showcase deployment.
#
# Stage 1: Rust release build of audit-server. No scanner binaries are bundled
#          — the audit endpoints are gated off in showcase mode.
# Stage 2: Node build of the React SPA.
# Stage 3: Slim runtime — just the server binary and the static bundle.
####

# ---- stage 1: rust ----
FROM rust:1-slim-bookworm AS rust-builder
WORKDIR /build
RUN apt-get update && apt-get install -y --no-install-recommends pkg-config && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.lock* ./
COPY crates ./crates

# src-tauri is a workspace member but bundles the Tauri toolchain (huge, native-
# only). Replace with a stub so the workspace resolves without pulling it in.
RUN mkdir -p src-tauri/src \
 && printf '[package]\nname = "audit-app"\nversion = "0.0.0"\nedition = "2021"\n\n[lib]\npath = "src/lib.rs"\n' > src-tauri/Cargo.toml \
 && echo "// docker stub" > src-tauri/src/lib.rs

RUN cargo build --release -p audit-server


# ---- stage 2: ui ----
FROM node:20-slim AS ui-builder
WORKDIR /ui
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
RUN npm run build


# ---- stage 3: runtime ----
FROM debian:bookworm-slim AS runtime
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates wget \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd -r sentinel && useradd -r -g sentinel -d /app -s /sbin/nologin sentinel

WORKDIR /app
COPY --from=rust-builder /build/target/release/audit-server /usr/local/bin/audit-server
COPY --from=ui-builder   /ui/dist /app/dist
RUN chown -R sentinel:sentinel /app

USER sentinel
ENV SENTINEL_BIND=0.0.0.0:7777 \
    SENTINEL_STATIC_DIR=/app/dist \
    SENTINEL_MODE=showcase \
    RUST_LOG=info,tower_http=warn

EXPOSE 7777
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1:7777/api/health || exit 1
CMD ["audit-server"]
