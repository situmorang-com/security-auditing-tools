import { motion } from "framer-motion";
import { CheckCircle2, XCircle, ExternalLink, ArrowRight } from "lucide-react";
import { useStore } from "../lib/store";
import { runAudit } from "../lib/transport";
import { CATEGORY_LABEL } from "../lib/types";

export function Preflight() {
  const items = useStore((s) => s.preflight);
  const target = useStore((s) => s.target);
  const setStage = useStore((s) => s.setStage);

  const installed = items.filter((i) => i.install.installed).length;

  async function start() {
    if (!target) return;
    setStage("scanning");
    // Fire and forget — events stream in via tauri listener.
    runAudit(target).catch(console.error);
  }

  return (
    <div className="max-w-5xl mx-auto px-8 py-10">
      <div className="text-[11px] uppercase tracking-[0.2em] text-indigo-300/80 mb-2">Step 2 of 4</div>
      <h1 className="text-4xl font-semibold tracking-tight">Scanner preflight</h1>
      <p className="text-slate-400 mt-2">
        {installed} of {items.length} scanners are installed. Missing ones will be skipped — copy the install hint to
        add them.
      </p>

      <div className="grid grid-cols-2 gap-3 mt-8">
        {items.map((p, i) => (
          <motion.div
            key={p.info.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 * i }}
            className="relative p-4 rounded-xl border border-white/5 bg-white/[0.02]"
          >
            <div className="flex items-start gap-3">
              {p.install.installed ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-400/70 mt-0.5 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="font-medium truncate">{p.info.display_name}</div>
                  <a
                    href={p.info.homepage}
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-500 hover:text-slate-300 shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
                <div className="text-xs text-slate-500">{CATEGORY_LABEL[p.info.category]}</div>
                {p.install.installed ? (
                  <div className="text-xs font-mono text-emerald-300/80 mt-2 truncate">
                    {p.install.version ?? "installed"}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 mt-2 font-mono break-words">{p.info.install_hint}</div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-8 flex justify-between items-center">
        <button onClick={() => setStage("onboarding")} className="text-sm text-slate-400 hover:text-slate-200">
          ← back
        </button>
        <button
          onClick={start}
          disabled={installed === 0}
          className="group flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Run audit ({installed} scanner{installed === 1 ? "" : "s"})
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
        </button>
      </div>
    </div>
  );
}
