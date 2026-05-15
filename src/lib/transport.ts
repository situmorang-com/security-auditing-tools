/**
 * Transport shim. The same React UI runs as a Tauri desktop app *and* a web
 * SPA backed by audit-server (Axum). At runtime we pick the right impl based
 * on whether the Tauri bridge is present in window.
 */
import type { AuditRun, PreflightItem, ScanEvent, Target, Tip } from "./types";

export const isTauri =
  typeof window !== "undefined" &&
  ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

export const isWeb = !isTauri;

// ---- Tauri implementation (lazy-loaded only when running in Tauri) ----

async function tauri() {
  const core = await import("@tauri-apps/api/core");
  const event = await import("@tauri-apps/api/event");
  return { core, event };
}

// ---- Public API ----

export async function preflight(): Promise<PreflightItem[]> {
  if (isTauri) {
    const { core } = await tauri();
    return core.invoke("preflight");
  }
  const r = await fetch("/api/preflight");
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function runAudit(target: Target): Promise<AuditRun> {
  if (isTauri) {
    const { core } = await tauri();
    return core.invoke("run_audit", { target });
  }
  const r = await fetch("/api/audit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ target }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function listTips(): Promise<Tip[]> {
  if (isTauri) {
    const { core } = await tauri();
    return core.invoke("list_tips");
  }
  const r = await fetch("/api/tips");
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export interface ServerMode {
  mode: "full" | "showcase";
  scanning_enabled: boolean;
}

export async function getServerMode(): Promise<ServerMode> {
  if (isTauri) {
    // Desktop app always has full capabilities.
    return { mode: "full", scanning_enabled: true };
  }
  try {
    const r = await fetch("/api/mode");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  } catch {
    // If the mode endpoint is unreachable, assume the safer showcase posture.
    return { mode: "showcase", scanning_enabled: false };
  }
}

export async function exportReport(
  format: "json" | "sarif" | "markdown" | "html"
): Promise<string> {
  if (isTauri) {
    const { core } = await tauri();
    return core.invoke("export_report", { format });
  }
  const r = await fetch(`/api/report?format=${encodeURIComponent(format)}`);
  if (!r.ok) throw new Error(await r.text());
  return r.text();
}

// ---- Event streams ----

export type Unlisten = () => void;

export async function onScanEvent(cb: (ev: ScanEvent) => void): Promise<Unlisten> {
  if (isTauri) {
    const { event } = await tauri();
    return await event.listen<ScanEvent>("scan-event", (e) => cb(e.payload));
  }
  return subscribeSse<ScanEvent>("scan-event", cb);
}

export async function onScanComplete(cb: (run: AuditRun) => void): Promise<Unlisten> {
  if (isTauri) {
    const { event } = await tauri();
    return await event.listen<AuditRun>("scan-complete", (e) => cb(e.payload));
  }
  return subscribeSse<AuditRun>("scan-complete", cb);
}

// ---- SSE plumbing ----
//
// The Axum server multiplexes both event kinds onto a single SSE endpoint
// (/api/events) with named events. We share one EventSource across listeners.

let sseSource: EventSource | null = null;
const sseListeners: Record<string, Set<(payload: unknown) => void>> = {
  "scan-event": new Set(),
  "scan-complete": new Set(),
};

function ensureSse() {
  if (sseSource) return;
  sseSource = new EventSource("/api/events");
  for (const name of Object.keys(sseListeners)) {
    sseSource.addEventListener(name, (e) => {
      try {
        const parsed = JSON.parse((e as MessageEvent).data);
        for (const cb of sseListeners[name]) cb(parsed);
      } catch { /* malformed; ignore */ }
    });
  }
}

function subscribeSse<T>(name: string, cb: (payload: T) => void): Unlisten {
  ensureSse();
  const wrapped = (p: unknown) => cb(p as T);
  sseListeners[name].add(wrapped);
  return () => {
    sseListeners[name].delete(wrapped);
    const total = Object.values(sseListeners).reduce((a, s) => a + s.size, 0);
    if (total === 0 && sseSource) {
      sseSource.close();
      sseSource = null;
    }
  };
}

// ---- Native dialog (Tauri only); web returns null and the UI hides the button. ----

export async function pickDirectory(): Promise<string | null> {
  if (!isTauri) return null;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const result = await open({ directory: true, multiple: false });
  return typeof result === "string" ? result : null;
}
