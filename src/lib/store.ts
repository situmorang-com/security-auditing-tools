import { create } from "zustand";
import type { AuditRun, Finding, PreflightItem, ScanEvent, Target } from "./types";

export type Stage = "welcome" | "onboarding" | "preflight" | "scanning" | "results" | "tips" | "maturity";

interface State {
  stage: Stage;
  scanningEnabled: boolean;
  target: Target | null;
  preflight: PreflightItem[];
  scannerProgress: Record<string, { pct: number; status: "idle" | "running" | "done" | "failed"; message?: string; foundCount: number; error?: string }>;
  liveFindings: Finding[];
  run: AuditRun | null;

  setStage: (s: Stage) => void;
  setScanningEnabled: (enabled: boolean) => void;
  setTarget: (t: Target | null) => void;
  setPreflight: (p: PreflightItem[]) => void;
  handleEvent: (ev: ScanEvent) => void;
  setRun: (r: AuditRun) => void;
  reset: () => void;
}

export const useStore = create<State>((set) => ({
  stage: "welcome",
  scanningEnabled: true,
  target: null,
  preflight: [],
  scannerProgress: {},
  liveFindings: [],
  run: null,

  setStage: (stage) => set({ stage }),
  setScanningEnabled: (scanningEnabled) => set({ scanningEnabled }),
  setTarget: (target) => set({ target }),
  setPreflight: (preflight) => set({ preflight }),
  setRun: (run) => set({ run, stage: "results" }),
  reset: () => set((s) => ({
    stage: s.scanningEnabled ? "onboarding" : "welcome",
    target: null, scannerProgress: {}, liveFindings: [], run: null,
  })),

  handleEvent: (ev) => set((s) => {
    const sp = { ...s.scannerProgress };
    const cur = sp[ev.scanner] ?? { pct: 0, status: "idle" as const, foundCount: 0 };
    if (ev.type === "started")    sp[ev.scanner] = { ...cur, status: "running", pct: 0.02 };
    if (ev.type === "progress")   sp[ev.scanner] = { ...cur, status: "running", pct: Math.max(cur.pct, ev.pct), message: ev.message ?? cur.message };
    if (ev.type === "finished")   sp[ev.scanner] = { ...cur, status: "done", pct: 1, foundCount: ev.found };
    if (ev.type === "failed")     sp[ev.scanner] = { ...cur, status: "failed", error: ev.error };
    if (ev.type === "finding") {
      sp[ev.scanner] = { ...cur, foundCount: cur.foundCount + 1 };
      return { scannerProgress: sp, liveFindings: [ev.finding, ...s.liveFindings].slice(0, 250) };
    }
    return { scannerProgress: sp };
  }),
}));
