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

## How builds work

The image is built by **GitHub Actions** ([.github/workflows/docker.yml](.github/workflows/docker.yml)) on every push to `main`, then published to **GHCR** as:

```
ghcr.io/situmorang-com/security-auditing-tools:latest
ghcr.io/situmorang-com/security-auditing-tools:sha-<short>
```

Coolify **pulls** that image — it does not build anything itself. This avoids OOM-killing the cargo release build on small VPSes (the original failure we hit) and gives near-instant deploys (~10 s vs ~3 min).

## Coolify setup (one-time)

1. In Coolify → **Add Resource → Docker Compose** → pick this repo's `docker-compose.yml`. Alternatively, **Add Resource → Docker Image** and paste the GHCR URL directly — Coolify supports both.
2. **Domain**: `security.situmorang.com`. Coolify provisions Let's Encrypt automatically. Reverse proxy targets the EXPOSE'd port (`7777`).
3. **Environment** (defaults in compose file are correct):
   - `SENTINEL_MODE=showcase`
   - `RUST_LOG=info,tower_http=warn` (optional)
4. **DNS**: point `security.situmorang.com` A/AAAA at your Coolify host's IP.
5. Click **Deploy**. Coolify pulls the latest image. First pull is ~80 MB.

## Updating

Push to `main` → GHA builds + publishes a new `:latest` → click **Redeploy** in Coolify (or enable auto-redeploy on image change). The `pull_policy: always` in the compose file ensures a fresh pull on every redeploy.

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
