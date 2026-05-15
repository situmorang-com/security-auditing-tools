# Deploying Sentinel to Coolify

Target deployment: **security.situmorang.com**, **showcase mode** (no scanning exposed; only Tips library + Maturity assessment).

## What gets deployed

A small Docker image (~80 MB):

- A static React SPA (`/app/dist`)
- The Axum `audit-server` binary, running in `SENTINEL_MODE=showcase`

In showcase mode the audit endpoints (`/api/preflight`, `/api/audit`, `/api/report`, `/api/events`) return **403 Forbidden**. Only `/api/health`, `/api/mode`, and `/api/tips` are reachable. The frontend detects this via `/api/mode` and hides every UI element that would call a gated endpoint — visitors land on a Welcome page that routes them to Tips or Maturity, both of which work entirely client-side.

## Files Coolify needs

- `Dockerfile` — multi-stage (Rust release build → Node SPA build → `debian:bookworm-slim` runtime).
- `docker-compose.yml` — declares the service, env vars, healthcheck. Coolify picks this up.
- `.dockerignore` — keeps `target/`, `node_modules/`, Tauri artifacts out of build context.

## Coolify setup (one-time)

1. **Create a new resource** in Coolify → **Docker Compose** → connect this repo.
2. **Build pack**: leave on `dockerfile` / `docker-compose.yml` (Coolify auto-detects).
3. **Domain**: set to `security.situmorang.com`. Coolify provisions a Let's Encrypt cert automatically. The reverse proxy targets the service's exposed port (`7777`).
4. **Environment variables** (Coolify UI → Environment):
   - `SENTINEL_MODE=showcase` (this is also the Dockerfile default — explicit > implicit)
   - `RUST_LOG=info,tower_http=warn` (optional)
5. **DNS**: point `security.situmorang.com` A/AAAA at your Coolify host's IP (or set the CNAME if you proxy through Cloudflare etc.). Wait for propagation, then click **Deploy** in Coolify.

That's it. First build takes ~3 min (Rust + npm caches warm up on subsequent deploys). Healthcheck pings `/api/health` every 30s — Coolify will mark the service Unhealthy if the binary stops responding.

## Verifying the deployment is safe

```bash
# These should all return 200:
curl https://security.situmorang.com/api/health           # → "ok"
curl https://security.situmorang.com/api/mode             # → {"mode":"showcase","scanning_enabled":false}
curl https://security.situmorang.com/api/tips             # → JSON array

# These MUST return 403:
curl https://security.situmorang.com/api/preflight        # → 403
curl -X POST https://security.situmorang.com/api/audit \
     -H 'content-type: application/json' \
     -d '{"target":{"kind":"directory","path":"/etc"}}'   # → 403
```

If any of the bottom three returns anything other than 403, **do not leave the domain public** — open an issue / check that `SENTINEL_MODE=showcase` is actually being set.

## Local container smoke test

```bash
docker build -t sentinel:dev .
docker run --rm -p 7777:7777 -e SENTINEL_MODE=showcase sentinel:dev
# then in another shell:
open http://localhost:7777
```

## Switching to "full" mode later

If you ever want the live instance to actually scan things (don't do this on the public domain), set `SENTINEL_MODE=full` and bake the scanner binaries into a new Dockerfile stage:

```dockerfile
RUN apt-get update && apt-get install -y nmap \
 && curl -sSL https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz | tar -xz -C /usr/local/bin gitleaks \
 && curl -sSL https://github.com/aquasecurity/trivy/releases/download/v0.55.2/trivy_0.55.2_Linux-64bit.tar.gz | tar -xz -C /usr/local/bin trivy \
 ...
```

…and put the deployment behind auth + a private network. The public showcase domain should stay in showcase mode.

## Why the Dockerfile stubs `src-tauri/`

The workspace `Cargo.toml` lists `src-tauri` as a member, but the Tauri toolchain pulls in ~1 GB of native deps that this server image doesn't need. The Dockerfile replaces `src-tauri/Cargo.toml` and `src-tauri/src/lib.rs` with a trivial stub before invoking `cargo build`, so the workspace resolves but Tauri is never compiled. The real `src-tauri` is untouched in your working tree.
