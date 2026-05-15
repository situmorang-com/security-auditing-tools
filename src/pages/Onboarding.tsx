import { useState } from "react";
import { motion } from "framer-motion";
import { Folder, Globe, Box, Server, ArrowRight, FolderOpen } from "lucide-react";
import { useStore } from "../lib/store";
import { isTauri, pickDirectory, preflight } from "../lib/transport";
import type { Target } from "../lib/types";

type Kind = Target["kind"];

const choices: { kind: Kind; title: string; subtitle: string; icon: any; example: string }[] = [
  { kind: "directory", title: "Code repository", subtitle: "Scan source for SAST, dependencies, secrets, IaC", icon: Folder, example: "~/projects/my-app" },
  { kind: "url", title: "Live web app", subtitle: "DAST + network reconnaissance against a URL", icon: Globe, example: "https://staging.example.com" },
  { kind: "container-image", title: "Container image", subtitle: "OS + library CVEs and config misconfigs", icon: Box, example: "alpine:3.19" },
  { kind: "ssh-host", title: "Server / host", subtitle: "Network exposure + host hardening", icon: Server, example: "user@prod-1.example.com" },
];

export function Onboarding() {
  const setStage = useStore((s) => s.setStage);
  const setTarget = useStore((s) => s.setTarget);
  const setPreflight = useStore((s) => s.setPreflight);

  const [kind, setKind] = useState<Kind>("directory");
  const [path, setPath] = useState("");
  const [url, setUrl] = useState("");
  const [image, setImage] = useState("");
  const [sshUser, setSshUser] = useState("");
  const [sshHost, setSshHost] = useState("");

  const canContinue =
    (kind === "directory" && path.trim()) ||
    (kind === "url" && url.trim()) ||
    (kind === "container-image" && image.trim()) ||
    (kind === "ssh-host" && sshHost.trim() && sshUser.trim());

  async function pickFolder() {
    const result = await pickDirectory();
    if (result) setPath(result);
  }

  async function next() {
    let t: Target;
    switch (kind) {
      case "directory":       t = { kind, path: path.trim() }; break;
      case "url":             t = { kind, url: url.trim() }; break;
      case "container-image": t = { kind, image: image.trim() }; break;
      case "ssh-host":        t = { kind, host: sshHost.trim(), user: sshUser.trim() }; break;
    }
    setTarget(t);
    const pf = await preflight();
    setPreflight(pf);
    setStage("preflight");
  }

  return (
    <div className="max-w-5xl mx-auto px-8 py-10">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
        <div className="text-[11px] uppercase tracking-[0.2em] text-indigo-300/80 mb-2">Step 1 of 4</div>
        <h1 className="text-4xl font-semibold tracking-tight">What are we auditing today?</h1>
        <p className="text-slate-400 mt-2 max-w-2xl">
          Choose a target. Sentinel will pick the right scanners, check they're installed, then run them in parallel.
        </p>
      </motion.div>

      <div className="grid grid-cols-2 gap-4 mt-8">
        {choices.map((c, i) => {
          const Icon = c.icon;
          const active = kind === c.kind;
          return (
            <motion.button
              key={c.kind}
              onClick={() => setKind(c.kind)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
              whileHover={{ y: -2 }}
              className={`relative text-left p-5 rounded-2xl border transition ${
                active
                  ? "border-indigo-400/50 bg-indigo-500/10 shadow-[0_0_40px_-12px_rgba(99,102,241,0.6)]"
                  : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${active ? "bg-indigo-500/20 text-indigo-200" : "bg-white/5 text-slate-300"}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">{c.title}</div>
                  <div className="text-sm text-slate-400 mt-0.5">{c.subtitle}</div>
                  <div className="text-xs text-slate-500 mt-2 font-mono">e.g. {c.example}</div>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      <motion.div
        layout
        className="mt-6 p-5 rounded-2xl border border-white/5 bg-white/[0.02]"
      >
        {kind === "directory" && (
          <div className="flex gap-2">
            <input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/absolute/path/to/repo"
              className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-indigo-400/50"
            />
            {isTauri && (
              <button onClick={pickFolder} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm">
                <FolderOpen className="w-4 h-4" /> Browse
              </button>
            )}
          </div>
        )}
        {kind === "url" && (
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-indigo-400/50"
          />
        )}
        {kind === "container-image" && (
          <input
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="registry/image:tag"
            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-indigo-400/50"
          />
        )}
        {kind === "ssh-host" && (
          <div className="grid grid-cols-2 gap-2">
            <input
              value={sshUser}
              onChange={(e) => setSshUser(e.target.value)}
              placeholder="user"
              className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-indigo-400/50"
            />
            <input
              value={sshHost}
              onChange={(e) => setSshHost(e.target.value)}
              placeholder="host or ip"
              className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-indigo-400/50"
            />
          </div>
        )}
      </motion.div>

      <div className="mt-8 flex justify-end">
        <button
          disabled={!canContinue}
          onClick={next}
          className="group flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Continue
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
        </button>
      </div>
    </div>
  );
}
