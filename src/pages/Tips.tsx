import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, ExternalLink, CheckCircle2 } from "lucide-react";
import { listTips } from "../lib/transport";
import { CATEGORY_LABEL, SEVERITY_COLORS } from "../lib/types";
import type { Category, Tip } from "../lib/types";

const CATS: Category[] = [
  "secrets", "sca", "sast", "iac", "container", "dast", "network", "host-hardening", "cloud",
];

export function Tips() {
  const [tips, setTips] = useState<Tip[]>([]);
  const [active, setActive] = useState<Category | "all">("all");

  useEffect(() => { listTips().then(setTips); }, []);

  const visible = active === "all" ? tips : tips.filter((t) => t.category === active);

  return (
    <div className="max-w-6xl mx-auto px-8 py-10">
      <div className="text-[11px] uppercase tracking-[0.2em] text-amber-300/80 mb-2 flex items-center gap-2">
        <BookOpen className="w-3 h-3" /> Hardening library
      </div>
      <h1 className="text-4xl font-semibold tracking-tight">Tips to harden the whole experience</h1>
      <p className="text-slate-400 mt-2 max-w-2xl">
        Curated, actionable security guidance. Pair these with the audit results — most findings have a matching tip.
      </p>

      <div className="flex flex-wrap gap-2 mt-8">
        <Pill active={active === "all"} onClick={() => setActive("all")}>All</Pill>
        {CATS.map((c) => (
          <Pill key={c} active={active === c} onClick={() => setActive(c)}>
            {CATEGORY_LABEL[c]}
          </Pill>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 mt-6">
        {visible.map((t, i) => {
          const c = SEVERITY_COLORS[t.severity_floor];
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 * i }}
              className="p-5 rounded-2xl border border-white/5 bg-white/[0.02]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className={`inline-block text-[10px] uppercase tracking-[0.16em] px-2 py-0.5 rounded ${c.bg} ${c.fg} mb-2`}>
                    {CATEGORY_LABEL[t.category]}
                  </div>
                  <div className="font-medium">{t.title}</div>
                  <div className="text-sm text-slate-400 mt-1">{t.summary}</div>
                </div>
              </div>
              <ul className="mt-4 space-y-1.5">
                {t.steps.map((s, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-emerald-400/80 shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
              {t.references.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {t.references.map((r) => (
                    <a key={r} href={r} target="_blank" rel="noreferrer" className="text-xs text-indigo-300 hover:text-indigo-200 inline-flex items-center gap-1 truncate max-w-[260px]">
                      <ExternalLink className="w-3 h-3" /> {r.replace(/^https?:\/\//, "")}
                    </a>
                  ))}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs rounded-full transition ${
        active ? "bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-400/40" : "bg-white/5 text-slate-300 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}
