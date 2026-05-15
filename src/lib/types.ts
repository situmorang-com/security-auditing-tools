// Mirror of audit_core types — keep in sync if you change the Rust structs.

export type Severity = "info" | "low" | "medium" | "high" | "critical";

export type Category =
  | "sast" | "sca" | "secrets" | "iac"
  | "container" | "dast" | "network"
  | "host-hardening" | "cloud";

export interface Location {
  path: string | null;
  start_line: number | null;
  end_line: number | null;
  snippet: string | null;
}

export interface Finding {
  id: string;
  scanner: string;
  category: Category;
  severity: Severity;
  cwe: string[];
  title: string;
  description: string;
  location: Location;
  fix_suggestion: string | null;
  references: string[];
  fingerprint: string;
  raw: unknown;
}

export interface ScannerInfo {
  id: string;
  display_name: string;
  category: Category;
  upstream_binary: string;
  install_hint: string;
  homepage: string;
}

export interface InstallStatus {
  scanner_id: string;
  installed: boolean;
  version: string | null;
  binary_path: string | null;
}

export interface PreflightItem {
  info: ScannerInfo;
  install: InstallStatus;
}

export interface ScannerOutcome {
  info: ScannerInfo;
  install: InstallStatus;
  findings_count: number;
  error: string | null;
  duration_ms: number;
}

export interface AuditRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  target_label: string;
  findings: Finding[];
  per_scanner: Record<string, ScannerOutcome>;
}

export type Target =
  | { kind: "directory"; path: string }
  | { kind: "url"; url: string }
  | { kind: "container-image"; image: string }
  | { kind: "ssh-host"; host: string; user: string };

export type ScanEvent =
  | { type: "started"; scanner: string; scan_id: string }
  | { type: "progress"; scanner: string; scan_id: string; pct: number; message: string | null }
  | { type: "finding"; scanner: string; scan_id: string; finding: Finding }
  | { type: "finished"; scanner: string; scan_id: string; found: number }
  | { type: "failed"; scanner: string; scan_id: string; error: string };

export interface Tip {
  id: string;
  title: string;
  category: Category;
  severity_floor: Severity;
  summary: string;
  steps: string[];
  applies_to: string[];
  references: string[];
}

export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 5, high: 4, medium: 3, low: 2, info: 1,
};

export const SEVERITY_COLORS: Record<Severity, { fg: string; bg: string; ring: string }> = {
  critical: { fg: "text-rose-200", bg: "bg-rose-500/15", ring: "ring-rose-500/40" },
  high:     { fg: "text-orange-200", bg: "bg-orange-500/15", ring: "ring-orange-500/40" },
  medium:   { fg: "text-amber-200", bg: "bg-amber-500/15", ring: "ring-amber-500/40" },
  low:      { fg: "text-sky-200", bg: "bg-sky-500/15", ring: "ring-sky-500/40" },
  info:     { fg: "text-slate-300", bg: "bg-slate-500/15", ring: "ring-slate-500/40" },
};

export const CATEGORY_LABEL: Record<Category, string> = {
  sast: "Static Code", sca: "Dependencies", secrets: "Secrets",
  iac: "Infrastructure-as-Code", container: "Containers", dast: "Web App (DAST)",
  network: "Network", "host-hardening": "Host Hardening", cloud: "Cloud Posture",
};
