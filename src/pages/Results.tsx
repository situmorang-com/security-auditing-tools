import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Download, Filter, ShieldCheck, Lightbulb } from "lucide-react";
import { useStore } from "../lib/store";
import { exportReport } from "../lib/transport";
import { SEVERITY_COLORS, SEVERITY_RANK, CATEGORY_LABEL } from "../lib/types";
import type { Finding, Severity } from "../lib/types";

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

export function Results() {
  const run = useStore((s) => s.run);
  const setStage = useStore((s) => s.setStage);
  const [filter, setFilter] = useState<Severity | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const findings = run?.findings ?? [];

  const counts = useMemo(() => {
    const c: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const f of findings) c[f.severity]++;
    return c;
  }, [findings]);

  const grouped = useMemo(() => {
    const visible = filter === "all" ? findings : findings.filter((f) => f.severity === filter);
    return [...visible].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
  }, [findings, filter]);

  async function doExport(fmt: "json" | "sarif" | "markdown" | "html") {
    const content = await exportReport(fmt);
    const blob = new Blob([content], { type: fmt === "html" ? "text/html" : "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-${run?.id ?? "report"}.${fmt === "markdown" ? "md" : fmt}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!run) {
    return (
      <div className="max-w-5xl mx-auto px-8 py-10 text-slate-400">No audit run yet. Start from the onboarding step.</div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-8 py-10">
      <div className="text-[11px] uppercase tracking-[0.2em] text-indigo-300/80 mb-2">Step 4 of 4</div>
      <h1 className="text-4xl font-semibold tracking-tight">Results</h1>
      <p className="text-slate-400 mt-2 font-mono text-sm">{run.target_label}</p>

      <div className="grid grid-cols-5 gap-3 mt-8">
        {SEVERITY_ORDER.map((sev) => {
          const c = SEVERITY_COLORS[sev];
          const isActive = filter === sev;
          return (
            <motion.button
              key={sev}
              onClick={() => setFilter(isActive ? "all" : sev)}
              whileHover={{ y: -2 }}
              className={`relative p-4 rounded-2xl border text-left transition ${
                isActive ? `${c.ring} ring-2` : "border-white/5"
              } ${c.bg}`}
            >
              <div className={`text-[10px] uppercase tracking-[0.18em] ${c.fg}`}>{sev}</div>
              <motion.div
                key={counts[sev]}
                initial={{ scale: 1.2, opacity: 0.6 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-3xl font-semibold tabular-nums mt-1"
              >
                {counts[sev]}
              </motion.div>
            </motion.button>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-8">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Filter className="w-4 h-4" />
          <span>{filter === "all" ? `${findings.length} findings` : `${grouped.length} ${filter} findings`}</span>
          {filter !== "all" && (
            <button onClick={() => setFilter("all")} className="ml-2 text-xs text-indigo-300 hover:text-indigo-200">
              clear filter
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setStage("tips")} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-200 hover:bg-amber-500/25 text-sm">
            <Lightbulb className="w-3.5 h-3.5" /> Hardening tips
          </button>
          {(["sarif", "html", "markdown", "json"] as const).map((fmt) => (
            <button key={fmt} onClick={() => doExport(fmt)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm">
              <Download className="w-3.5 h-3.5" /> {fmt.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {grouped.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-8 p-10 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 text-center">
          <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto" />
          <div className="mt-3 text-lg font-medium">All clear for this filter.</div>
          <div className="text-sm text-slate-400 mt-1">
            Don't celebrate too hard — re-run weekly and on every PR. Open the Tips library to keep hardening.
          </div>
        </motion.div>
      ) : (
        <div className="mt-4 space-y-2">
          {grouped.map((f) => (
            <FindingCard
              key={f.fingerprint + f.scanner}
              f={f}
              expanded={expanded === f.fingerprint + f.scanner}
              onToggle={() => setExpanded(expanded === f.fingerprint + f.scanner ? null : f.fingerprint + f.scanner)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FindingCard({ f, expanded, onToggle }: { f: Finding; expanded: boolean; onToggle: () => void }) {
  const c = SEVERITY_COLORS[f.severity];
  return (
    <motion.div layout className={`rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden`}>
      <button onClick={onToggle} className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/[0.02]">
        <ChevronRight className={`w-4 h-4 text-slate-500 transition ${expanded ? "rotate-90" : ""}`} />
        <span className={`text-[10px] uppercase tracking-[0.16em] px-2 py-0.5 rounded-md ${c.bg} ${c.fg}`}>
          {f.severity}
        </span>
        <span className="text-[11px] text-slate-500 font-mono">{f.scanner}</span>
        <span className="text-[11px] text-slate-500">·</span>
        <span className="text-[11px] text-slate-500">{CATEGORY_LABEL[f.category]}</span>
        <span className="flex-1 truncate font-medium">{f.title}</span>
        {f.location.path && (
          <span className="text-xs text-slate-500 font-mono shrink-0 truncate max-w-[280px]">
            {f.location.path}{f.location.start_line ? `:${f.location.start_line}` : ""}
          </span>
        )}
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-white/5"
          >
            <div className="p-5 space-y-4">
              {f.description && (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-1">What it is</div>
                  <div className="text-sm text-slate-200 whitespace-pre-wrap">{f.description}</div>
                </div>
              )}
              {f.location.snippet && (
                <pre className="text-xs bg-black/40 border border-white/5 rounded-lg p-3 overflow-x-auto font-mono">
                  {f.location.snippet}
                </pre>
              )}
              {f.fix_suggestion && (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-300 mb-1">How to fix</div>
                  <div className="text-sm text-slate-200 whitespace-pre-wrap">{f.fix_suggestion}</div>
                </div>
              )}
              {(f.cwe.length > 0 || f.references.length > 0) && (
                <div className="flex flex-wrap gap-2">
                  {f.cwe.map((c) => (
                    <span key={c} className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-slate-300 font-mono">
                      {c}
                    </span>
                  ))}
                  {f.references.map((r) => (
                    <a key={r} href={r} target="_blank" rel="noreferrer" className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-200 hover:bg-indigo-500/25 truncate max-w-[300px]">
                      {r}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
