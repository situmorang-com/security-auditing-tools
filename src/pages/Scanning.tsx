import { motion, AnimatePresence } from "framer-motion";
import { Activity, AlertTriangle, Sparkles } from "lucide-react";
import { useStore } from "../lib/store";
import { SEVERITY_COLORS } from "../lib/types";

export function Scanning() {
  const preflight = useStore((s) => s.preflight);
  const progress = useStore((s) => s.scannerProgress);
  const live = useStore((s) => s.liveFindings);
  const run = useStore((s) => s.run);
  const setStage = useStore((s) => s.setStage);

  const active = preflight.filter((p) => p.install.installed);
  const totalFindings = Object.values(progress).reduce((a, b) => a + b.foundCount, 0);

  return (
    <div className="max-w-6xl mx-auto px-8 py-10 grid grid-cols-5 gap-6">
      <div className="col-span-3">
        <div className="text-[11px] uppercase tracking-[0.2em] text-indigo-300/80 mb-2">Step 3 of 4</div>
        <h1 className="text-4xl font-semibold tracking-tight flex items-center gap-3">
          Auditing
          <motion.span
            className="inline-block w-2 h-2 rounded-full bg-indigo-400"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          />
        </h1>
        <p className="text-slate-400 mt-2">Scanners run in parallel. Findings stream in below as they're discovered.</p>

        <div className="mt-6 space-y-2.5">
          {active.map((p, i) => {
            const sp = progress[p.info.id] ?? { pct: 0, status: "idle", foundCount: 0 };
            const pct = Math.round(sp.pct * 100);
            return (
              <motion.div
                key={p.info.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * i }}
                className="relative p-4 rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden"
              >
                {sp.status === "running" && (
                  <div className="absolute inset-0 pointer-events-none scan-sweep" />
                )}
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Activity
                      className={`w-4 h-4 ${
                        sp.status === "running" ? "text-indigo-300" :
                        sp.status === "done" ? "text-emerald-400" :
                        sp.status === "failed" ? "text-rose-400" : "text-slate-500"
                      }`}
                    />
                    <div>
                      <div className="text-sm font-medium">{p.info.display_name}</div>
                      <div className="text-xs text-slate-500">
                        {sp.status === "running" ? (sp.message ?? "running…") :
                         sp.status === "done" ? `${sp.foundCount} finding${sp.foundCount === 1 ? "" : "s"}` :
                         sp.status === "failed" ? `failed — ${sp.error}` : "queued"}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs font-mono tabular-nums text-slate-400 w-10 text-right">{pct}%</div>
                </div>
                <div className="mt-3 h-1 rounded-full bg-white/5 overflow-hidden">
                  <motion.div
                    className={`h-full ${sp.status === "failed" ? "bg-rose-400/70" : "bg-indigo-400"}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>

        {run && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setStage("results")}
            className="mt-6 w-full py-3 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-200 hover:bg-emerald-500/25"
          >
            Audit complete — view results
          </motion.button>
        )}
      </div>

      <div className="col-span-2">
        <div className="sticky top-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-300" />
              <div className="text-sm font-medium">Live findings</div>
            </div>
            <motion.div
              key={totalFindings}
              initial={{ scale: 1.3 }}
              animate={{ scale: 1 }}
              className="text-xs tabular-nums text-slate-400 font-mono"
            >
              {totalFindings} total
            </motion.div>
          </div>

          <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {live.slice(0, 40).map((f) => {
                const c = SEVERITY_COLORS[f.severity];
                return (
                  <motion.div
                    key={f.fingerprint + f.scanner}
                    layout
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className={`p-2.5 rounded-lg border border-white/5 ${c.bg}`}
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${c.fg}`} />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium truncate">{f.title}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                          {f.scanner} · {f.location.path ?? f.id}
                          {f.location.start_line ? `:${f.location.start_line}` : ""}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {live.length === 0 && (
              <div className="text-xs text-slate-500 italic p-4 text-center">
                no findings yet — keep watching…
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
