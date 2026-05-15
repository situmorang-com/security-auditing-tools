import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Shield } from "lucide-react";
import { useStore } from "./lib/store";
import { getServerMode, onScanComplete, onScanEvent } from "./lib/transport";
import { Welcome } from "./pages/Welcome";
import { Onboarding } from "./pages/Onboarding";
import { Preflight } from "./pages/Preflight";
import { Scanning } from "./pages/Scanning";
import { Results } from "./pages/Results";
import { Tips } from "./pages/Tips";
import { Maturity } from "./pages/Maturity";

function Header() {
  const stage = useStore((s) => s.stage);
  const scanningEnabled = useStore((s) => s.scanningEnabled);
  const setStage = useStore((s) => s.setStage);
  const reset = useStore((s) => s.reset);

  const scannerStages: { id: typeof stage; label: string }[] = [
    { id: "onboarding", label: "Target" },
    { id: "preflight", label: "Preflight" },
    { id: "scanning", label: "Scan" },
    { id: "results", label: "Results" },
  ];
  const alwaysStages: { id: typeof stage; label: string }[] = [
    { id: "tips", label: "Tips" },
    { id: "maturity", label: "Maturity" },
  ];
  const stages = scanningEnabled ? [...scannerStages, ...alwaysStages] : alwaysStages;

  return (
    <header className="flex items-center justify-between px-8 py-5 border-b border-white/5 backdrop-blur-md">
      <button onClick={reset} className="flex items-center gap-3 group">
        <div className="relative">
          <Shield className="w-7 h-7 text-indigo-400 group-hover:text-indigo-300 transition" />
          <motion.div
            className="absolute inset-0 rounded-full bg-indigo-400/30 blur-xl"
            animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0.1, 0.4] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
        </div>
        <div className="text-left">
          <div className="text-lg font-semibold tracking-tight">Sentinel</div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
            {scanningEnabled ? "Security Audit" : "Showcase"}
          </div>
        </div>
      </button>

      <nav className="flex items-center gap-1 text-sm">
        {stages.map((s, i) => {
          const active = s.id === stage;
          return (
            <div key={s.id} className="flex items-center">
              <button
                onClick={() => setStage(s.id)}
                className={`relative px-4 py-1.5 rounded-full transition ${
                  active ? "text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="stage-pill"
                    className="absolute inset-0 rounded-full bg-white/10 ring-1 ring-white/15"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative">{s.label}</span>
              </button>
              {i < stages.length - 1 && <span className="text-slate-700 mx-0.5">·</span>}
            </div>
          );
        })}
      </nav>
    </header>
  );
}

export default function App() {
  const stage = useStore((s) => s.stage);
  const scanningEnabled = useStore((s) => s.scanningEnabled);
  const setScanningEnabled = useStore((s) => s.setScanningEnabled);
  const setStage = useStore((s) => s.setStage);
  const handleEvent = useStore((s) => s.handleEvent);
  const setRun = useStore((s) => s.setRun);

  // Detect showcase vs full mode on mount.
  useEffect(() => {
    let cancelled = false;
    getServerMode().then((m) => {
      if (cancelled) return;
      setScanningEnabled(m.scanning_enabled);
      // In showcase mode we land on Welcome; in full mode start on Onboarding.
      setStage(m.scanning_enabled ? "onboarding" : "welcome");
    });
    return () => { cancelled = true; };
  }, [setScanningEnabled, setStage]);

  // Only subscribe to scan events when scanning is enabled — saves an SSE
  // connection in showcase mode.
  useEffect(() => {
    if (!scanningEnabled) return;
    const ps = [onScanEvent(handleEvent), onScanComplete(setRun)];
    return () => {
      ps.forEach((p) => p.then((u) => u()));
    };
  }, [scanningEnabled, handleEvent, setRun]);

  return (
    <div className="h-screen flex flex-col">
      <Header />
      <main className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={stage}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="h-full"
          >
            {stage === "welcome" && <Welcome />}
            {stage === "onboarding" && scanningEnabled && <Onboarding />}
            {stage === "preflight" && scanningEnabled && <Preflight />}
            {stage === "scanning" && scanningEnabled && <Scanning />}
            {stage === "results" && scanningEnabled && <Results />}
            {stage === "tips" && <Tips />}
            {stage === "maturity" && <Maturity />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
