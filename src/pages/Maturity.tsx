import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Award, BookOpen, ChevronDown, ExternalLink, Info, RotateCcw } from "lucide-react";
import {
  FRAMEWORKS,
  getFramework,
  maxScore,
  tierFromAvg,
  type Framework,
  type Func,
} from "../data/maturity";

const FRAMEWORK_KEY = "sentinel.maturity.framework";
const scoresKey = (fwId: string) => `sentinel.maturity.${fwId}.v1`;

type Scores = Record<string, number>;

function loadScores(fwId: string): Scores {
  try {
    const raw = localStorage.getItem(scoresKey(fwId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function saveScores(fwId: string, s: Scores) {
  try { localStorage.setItem(scoresKey(fwId), JSON.stringify(s)); } catch { /* ignore */ }
}
function loadFrameworkId(): Framework["id"] {
  try {
    const v = localStorage.getItem(FRAMEWORK_KEY);
    if (v === "nist-csf-2" || v === "cis-v8-ig1" || v === "samm-2") return v;
  } catch { /* ignore */ }
  return "nist-csf-2";
}

const ACCENT: Record<string, { ring: string; bg: string; text: string; bar: string }> = {
  indigo:  { ring: "stroke-indigo-400",  bg: "bg-indigo-500/10",  text: "text-indigo-200",  bar: "bg-indigo-400"  },
  sky:     { ring: "stroke-sky-400",     bg: "bg-sky-500/10",     text: "text-sky-200",     bar: "bg-sky-400"     },
  emerald: { ring: "stroke-emerald-400", bg: "bg-emerald-500/10", text: "text-emerald-200", bar: "bg-emerald-400" },
  amber:   { ring: "stroke-amber-400",   bg: "bg-amber-500/10",   text: "text-amber-200",   bar: "bg-amber-400"   },
  orange:  { ring: "stroke-orange-400",  bg: "bg-orange-500/10",  text: "text-orange-200",  bar: "bg-orange-400"  },
  rose:    { ring: "stroke-rose-400",    bg: "bg-rose-500/10",    text: "text-rose-200",    bar: "bg-rose-400"    },
};

export function Maturity() {
  const [fwId, setFwId] = useState<Framework["id"]>(() => loadFrameworkId());
  const fw = getFramework(fwId);

  // Scores are kept per-framework so switching tabs doesn't lose work.
  const [scores, setScores] = useState<Scores>(() => loadScores(fwId));
  const [activeFn, setActiveFn] = useState<string | "all">("all");
  const [aboutOpen, setAboutOpen] = useState(true);

  useEffect(() => { saveScores(fwId, scores); }, [fwId, scores]);
  useEffect(() => { try { localStorage.setItem(FRAMEWORK_KEY, fwId); } catch { /* ignore */ } }, [fwId]);

  function switchFramework(next: Framework["id"]) {
    setFwId(next);
    setScores(loadScores(next));
    setActiveFn("all");
  }

  const max = maxScore(fw);

  const perFunctionAvg = useMemo(() => {
    const out: Record<string, { avg: number; count: number; scored: number }> = {};
    for (const f of fw.functions) {
      let sum = 0, n = 0, scored = 0;
      for (const c of f.categories) for (const p of c.practices) {
        const v = scores[p.id] ?? 0;
        sum += v; n += 1;
        if (scores[p.id] !== undefined) scored += 1;
      }
      out[f.id] = { avg: n ? sum / n : 0, count: n, scored };
    }
    return out;
  }, [fw, scores]);

  const overall = useMemo(() => {
    const vals = Object.values(perFunctionAvg);
    const avg = vals.length ? vals.reduce((a, b) => a + b.avg, 0) / vals.length : 0;
    const scored = vals.reduce((a, b) => a + b.scored, 0);
    const total = vals.reduce((a, b) => a + b.count, 0);
    return { avg, scored, total, ...tierFromAvg(avg, fw) };
  }, [perFunctionAvg, fw]);

  const visibleFns: Func[] = activeFn === "all" ? fw.functions : fw.functions.filter((f) => f.id === activeFn);

  function setScore(id: string, v: number) {
    setScores((s) => ({ ...s, [id]: v }));
  }
  function reset() {
    if (confirm(`Clear all ${fw.shortName} scores?`)) setScores({});
  }

  return (
    <div className="max-w-6xl mx-auto px-8 py-10">
      <div className="text-[11px] uppercase tracking-[0.2em] text-emerald-300/80 mb-2 flex items-center gap-2">
        <BookOpen className="w-3 h-3" /> Maturity self-assessment
      </div>
      <h1 className="text-4xl font-semibold tracking-tight">How mature is your security program?</h1>
      <p className="text-slate-400 mt-2 max-w-2xl">
        Score yourself against world-standard frameworks. Scores stay in this browser — no upload, no telemetry.
        Use it as a quarterly checkpoint.
      </p>

      {/* Framework switcher */}
      <div className="mt-8 flex flex-wrap gap-2">
        {FRAMEWORKS.map((f) => {
          const active = fwId === f.id;
          return (
            <button
              key={f.id}
              onClick={() => switchFramework(f.id)}
              className={`relative px-4 py-2.5 rounded-xl border text-left transition ${
                active
                  ? "border-emerald-400/40 bg-emerald-500/10"
                  : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{f.shortName}</span>
                <span className={`text-[10px] uppercase tracking-[0.15em] px-1.5 py-0.5 rounded ${
                  active ? "bg-emerald-500/20 text-emerald-200" : "bg-white/5 text-slate-400"
                }`}>
                  {f.badge}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">{f.about.publisher}</div>
            </button>
          );
        })}
      </div>

      {/* About this framework — collapsible so it doesn't dominate the page once read */}
      <motion.div layout className="mt-4 rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
        <button
          onClick={() => setAboutOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-white/[0.02]"
        >
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium">About {fw.shortName}</span>
            <span className="text-[11px] text-slate-500">— {fw.name}</span>
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-500 transition ${aboutOpen ? "rotate-180" : ""}`} />
        </button>
        <AnimatePresence initial={false}>
          {aboutOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-t border-white/5 overflow-hidden"
            >
              <div className="px-5 py-5 grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                <AboutItem label="What it is">{fw.about.what}</AboutItem>
                <AboutItem label="Who it's for">{fw.about.whoFor}</AboutItem>
                <AboutItem label="How to score">{fw.about.howToScore}</AboutItem>
                <AboutItem label="When to pick this one">{fw.about.whenToUse}</AboutItem>
                <div className="col-span-2 flex items-center gap-2 text-xs pt-2 border-t border-white/5">
                  <span className="text-slate-500">Official reference:</span>
                  <a
                    href={fw.about.reference}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-300 hover:text-indigo-200 inline-flex items-center gap-1"
                  >
                    {fw.about.reference.replace(/^https?:\/\//, "")} <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Overall tier banner */}
      <motion.div
        key={fw.id}
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 p-6 rounded-2xl glow-border bg-white/[0.025] relative overflow-hidden"
      >
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Overall maturity · {fw.shortName}</div>
            <div className="flex items-baseline gap-3 mt-1">
              <motion.div
                key={overall.label}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-3xl font-semibold tracking-tight flex items-center gap-3"
              >
                <Award className="w-7 h-7 text-emerald-300" />
                {overall.label}
              </motion.div>
              <div className="text-sm text-slate-400 font-mono tabular-nums">
                avg {overall.avg.toFixed(2)} / {max.toFixed(2)}
              </div>
            </div>
            <div className="text-sm text-slate-400 mt-1">
              {overall.scored} of {overall.total} practices scored
              {overall.scored < overall.total && " — keep going for an accurate picture"}
            </div>
          </div>

          <button
            onClick={reset}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>

        {/* Function rings */}
        <div
          className="grid gap-3 mt-6"
          style={{ gridTemplateColumns: `repeat(${Math.min(fw.functions.length, 8)}, minmax(0, 1fr))` }}
        >
          {fw.functions.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFn(activeFn === f.id ? "all" : f.id)}
              className={`p-3 rounded-xl border transition text-left ${
                activeFn === f.id ? "border-white/20 bg-white/[0.04]" : "border-white/5 hover:bg-white/[0.02]"
              }`}
              title={f.tagline}
            >
              <Ring func={f} avg={perFunctionAvg[f.id]?.avg ?? 0} max={max} />
              <div className="mt-2 text-xs font-medium truncate">{f.name}</div>
              <div className="text-[10px] text-slate-500 truncate">{f.id}</div>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Function filter */}
      <div className="flex flex-wrap gap-2 mt-8">
        <FilterChip active={activeFn === "all"} onClick={() => setActiveFn("all")}>All functions</FilterChip>
        {fw.functions.map((f) => (
          <FilterChip key={f.id} active={activeFn === f.id} onClick={() => setActiveFn(f.id)}>
            {f.name}
          </FilterChip>
        ))}
      </div>

      <div className="mt-6 space-y-10">
        {visibleFns.map((f) => (
          <FunctionSection key={f.id} func={f} fw={fw} scores={scores} setScore={setScore} />
        ))}
      </div>
    </div>
  );
}

function AboutItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-1">{label}</div>
      <div className="text-slate-200 leading-relaxed">{children}</div>
    </div>
  );
}

function Ring({ func, avg, max }: { func: Func; avg: number; max: number }) {
  const pct = max > 0 ? avg / max : 0;
  const accent = ACCENT[func.accent] ?? ACCENT.indigo;
  const R = 22;
  const C = 2 * Math.PI * R;
  return (
    <div className="relative w-14 h-14">
      <svg viewBox="0 0 50 50" className="w-full h-full -rotate-90">
        <circle cx="25" cy="25" r={R} className="stroke-white/10 fill-none" strokeWidth="4" />
        <motion.circle
          cx="25" cy="25" r={R}
          className={`fill-none ${accent.ring}`}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - pct) }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </svg>
      <div className={`absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums ${accent.text}`}>
        {avg.toFixed(1)}
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs rounded-full transition ${
        active ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/40" : "bg-white/5 text-slate-300 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function FunctionSection({
  func, fw, scores, setScore,
}: {
  func: Func; fw: Framework; scores: Scores; setScore: (id: string, v: number) => void;
}) {
  const accent = ACCENT[func.accent] ?? ACCENT.indigo;
  return (
    <section>
      <div className="flex items-baseline gap-3">
        <div className={`text-[10px] uppercase tracking-[0.2em] px-2 py-0.5 rounded ${accent.bg} ${accent.text}`}>
          {func.id}
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">{func.name}</h2>
      </div>
      <p className="text-sm text-slate-400 mt-1">{func.tagline}</p>

      <div className="mt-4 space-y-4">
        {func.categories.map((cat) => (
          <div key={cat.id} className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
            <div className="px-5 py-3 border-b border-white/5">
              <div className="text-xs font-mono text-slate-500">{cat.id}</div>
              <div className="text-sm font-medium">{cat.title}</div>
            </div>
            <div className="divide-y divide-white/5">
              {cat.practices.map((p) => (
                <PracticeRow
                  key={p.id}
                  p={p}
                  score={scores[p.id] ?? 0}
                  hasScore={scores[p.id] !== undefined}
                  onChange={(v) => setScore(p.id, v)}
                  accent={accent}
                  fw={fw}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PracticeRow({
  p, score, hasScore, onChange, accent, fw,
}: {
  p: { id: string; title: string; rationale: string; examples: string[] };
  score: number;
  hasScore: boolean;
  onChange: (v: number) => void;
  accent: typeof ACCENT[string];
  fw: Framework;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="px-5 py-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-slate-400">{p.id}</span>
            <span className="font-medium">{p.title}</span>
            {!hasScore && (
              <span className="text-[10px] uppercase tracking-[0.15em] text-slate-500">unscored</span>
            )}
          </div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-slate-400 hover:text-slate-200 mt-1"
          >
            {expanded ? "hide details" : "why it matters"}
          </button>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {fw.levelLabels.map((lbl, i) => {
            const active = hasScore && score === i;
            return (
              <button
                key={i}
                onClick={() => onChange(i)}
                title={`${i}: ${lbl}`}
                className={`relative w-8 h-8 rounded-md text-xs font-medium tabular-nums transition ${
                  active ? `${accent.bar} text-slate-900` : "bg-white/5 text-slate-400 hover:bg-white/10"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId={`pill-${fw.id}-${p.id}`}
                    className={`absolute inset-0 rounded-md ${accent.bar}`}
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative">{i}</span>
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 p-4 rounded-lg bg-black/30 text-sm">
              <div className="text-slate-300">{p.rationale}</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mt-3 mb-1">Looks like</div>
              <ul className="space-y-1">
                {p.examples.map((ex, i) => (
                  <li key={i} className="text-slate-300 text-sm flex gap-2">
                    <span className="text-emerald-400/70">›</span>
                    <span>{ex}</span>
                  </li>
                ))}
              </ul>
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mt-3 mb-1">Scoring scale ({fw.shortName})</div>
              <div className="text-xs text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
                {fw.levelLabels.map((lbl, i) => (
                  <span key={i}>
                    <span className="text-slate-300">{i}</span> {lbl}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
