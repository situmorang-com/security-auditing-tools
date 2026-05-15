import { motion } from "framer-motion";
import { Shield, BookOpen, GraduationCap, Download, Github, ExternalLink, ArrowRight } from "lucide-react";
import { useStore } from "../lib/store";

export function Welcome() {
  const setStage = useStore((s) => s.setStage);

  const cards = [
    {
      title: "Hardening tips",
      blurb: "Curated, actionable security guidance covering secrets, dependencies, SAST, IaC, containers, DAST, network and host hardening — with concrete steps and references.",
      icon: BookOpen,
      cta: "Browse tips",
      go: () => setStage("tips"),
      accent: "from-indigo-500/20 to-indigo-500/5 ring-indigo-400/30",
    },
    {
      title: "Maturity assessment",
      blurb: "Score your program against three world-standard frameworks: NIST CSF 2.0, CIS Controls v8.1 (IG1), and OWASP SAMM 2.0. Local-only — your answers never leave your browser.",
      icon: GraduationCap,
      cta: "Start assessment",
      go: () => setStage("maturity"),
      accent: "from-emerald-500/20 to-emerald-500/5 ring-emerald-400/30",
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-8 py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center gap-4"
      >
        <div className="relative">
          <Shield className="w-12 h-12 text-indigo-400" />
          <motion.div
            className="absolute inset-0 rounded-full bg-indigo-400/30 blur-2xl"
            animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0.1, 0.4] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
        </div>
        <div>
          <h1 className="text-5xl font-semibold tracking-tight">Sentinel</h1>
          <div className="text-sm uppercase tracking-[0.2em] text-slate-400 mt-1">
            Security auditing tool — public showcase
          </div>
        </div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="text-lg text-slate-300 mt-6 max-w-2xl leading-relaxed"
      >
        Sentinel is a desktop tool that orchestrates best-in-class open-source scanners
        (Semgrep, Trivy, Gitleaks, Checkov, Nuclei, Nmap, Lynis) behind a guided UI.
        This public page hosts the two parts that are safe to share with the world.
      </motion.p>

      <div className="mt-12 grid grid-cols-2 gap-4">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <motion.button
              key={c.title}
              onClick={c.go}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.08 }}
              whileHover={{ y: -3 }}
              className={`group text-left p-6 rounded-2xl bg-gradient-to-br ${c.accent} ring-1 transition`}
            >
              <Icon className="w-7 h-7 text-white/90" />
              <div className="text-xl font-medium mt-4">{c.title}</div>
              <div className="text-sm text-slate-300 mt-2 leading-relaxed">{c.blurb}</div>
              <div className="mt-4 inline-flex items-center gap-1.5 text-sm text-white/90 group-hover:translate-x-0.5 transition">
                {c.cta} <ArrowRight className="w-4 h-4" />
              </div>
            </motion.button>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-10 p-5 rounded-2xl border border-white/5 bg-white/[0.02]"
      >
        <div className="flex items-start gap-3">
          <Download className="w-5 h-5 text-slate-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="font-medium">Want to actually run scans?</div>
            <div className="text-sm text-slate-400 mt-1 leading-relaxed">
              Scanning is intentionally disabled on the public showcase — it requires reading arbitrary filesystems
              and reaching out to arbitrary hosts. Run Sentinel locally as a Tauri desktop app to use the full
              orchestrator. Source and build instructions:
            </div>
            <a
              href="https://github.com/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 mt-3 text-sm text-indigo-300 hover:text-indigo-200"
            >
              <Github className="w-4 h-4" /> github.com — Sentinel <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
