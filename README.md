# Sentinel

A desktop security auditing tool that orchestrates best-in-class open-source scanners (Semgrep, Trivy, Gitleaks, Checkov, Nuclei, Nmap, Lynis) behind a guided, animated UI.

## What it does

- **Code & dependencies** — SAST (Semgrep), SCA / containers / IaC (Trivy), secrets (Gitleaks).
- **Infrastructure-as-Code (deep)** — Checkov.
- **Live web app (DAST)** — Nuclei.
- **Network / host** — Nmap, Lynis.
- **Guided UX** — onboarding picks the right scanners for your target, a preflight screen flags missing tools, the scanning view streams live findings, and a hardening-tips library helps you keep going.
- **Maturity assessment** — self-score against **NIST Cybersecurity Framework 2.0** (Govern / Identify / Protect / Detect / Respond / Recover). Persists locally; produces an overall CSF Tier (1 Partial → 4 Adaptive).

## Architecture

```
crates/
  core/          # Finding schema, Scanner trait, severity, target types
  orchestrator/  # Runs scanners concurrently, emits events, dedups results
  scanners/      # One module per upstream tool — implements Scanner trait
  reporter/      # JSON / SARIF 2.1.0 / Markdown / HTML export
  tips/          # Curated hardening tips, linkable to findings
src-tauri/       # Tauri 2 shell, commands bridging UI <-> orchestrator
src/             # React + Vite + Tailwind v4 + Framer Motion frontend
```

Each scanner is a wrapper: detect the upstream binary via `which`, run it as a subprocess, parse its native JSON/JSONL into the shared `Finding` schema. Adding a new scanner is one file implementing the `Scanner` trait + registering it in `scanners/src/lib.rs`.

## Running it

You need Rust (≥ 1.77) and Node (≥ 20).

```bash
# install upstream scanners you want to use (skip any you don't):
brew install gitleaks trivy nmap lynis nuclei
pipx install semgrep checkov

npm install
```

### Desktop (Tauri)

```bash
npm run tauri dev
```

### Web (Axum + browser)

The same React UI runs in a browser, talking to a small Axum backend (`crates/server`) over REST + Server-Sent Events.

```bash
# one-shot: build the SPA, then serve it on http://127.0.0.1:7777
npm run web

# dev with hot reload (two terminals):
npm run server:dev        # terminal 1 — API only on :7777
npm run dev               # terminal 2 — Vite on :5173, proxies /api to :7777
```

**Security note:** the server binds to `127.0.0.1` by default. Do **not** expose it on a public interface — the scanner pipeline can read arbitrary directories and SSH to hosts. Pass `--bind 0.0.0.0:7777` only behind an auth proxy on a trusted network.

The frontend detects Tauri vs. web at runtime and uses the right transport — same UI both ways. The native folder-picker is hidden in browser mode (paste the path instead).

### Export reports

From the Results page, export to **SARIF** (GitHub Code Scanning), **HTML** (human read), **Markdown** (PR comments), or **JSON** (pipelines).

## Status

| Scanner | Wrapper | Notes |
|---|---|---|
| Gitleaks | ✅ full | Secret scanning, redacts matched values. |
| Semgrep | ✅ full | Uses `--config auto`; CWE + metadata propagated. |
| Trivy | ✅ full | SCA + container + IaC + secrets, multi-target. |
| Checkov | ✅ stub-quality | Parses `failed_checks`; works against Terraform/k8s out of the box. |
| Nuclei | ✅ stub-quality | JSONL line parsing; templates auto-updated by upstream. |
| Nmap | ✅ stub-quality | Top-100 + service detect; flags risky ports. |
| Lynis | ✅ stub-quality | Local `audit system --quick`; suggestion parsing is line-based. |

"Stub-quality" means the wrapper works end-to-end but hasn't been hardened against every edge case in the upstream tool's output. The trait shape is identical, so improvements are localized.

## Next steps

- Wire baseline files (ignore findings that already exist; fail CI on new ones).
- Add a CLI mode (`audit-app --target ... --json`) for CI pipelines.
- Persist audit history in SQLite for trend lines on the dashboard.
- Replace placeholder app icons (`src-tauri/icons/`) with real ones — `npx tauri icon path/to/logo.png`.

## License

MIT.
