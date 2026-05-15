use crate::common;
use async_trait::async_trait;
use audit_core::{Category, Finding, InstallStatus, Location, ProgressTx, ScanEvent, Scanner, ScannerInfo, Severity, Target};
use serde::Deserialize;
use std::path::PathBuf;

pub struct Semgrep;

#[derive(Debug, Deserialize)]
struct SemgrepReport {
    results: Vec<SemgrepResult>,
}

#[derive(Debug, Deserialize)]
struct SemgrepResult {
    check_id: String,
    path: String,
    start: Pos,
    end: Pos,
    extra: SemgrepExtra,
}

#[derive(Debug, Deserialize)]
struct Pos {
    line: u32,
}

#[derive(Debug, Deserialize, Default)]
struct SemgrepExtra {
    message: Option<String>,
    severity: Option<String>,
    metadata: Option<serde_json::Value>,
    lines: Option<String>,
    fix: Option<String>,
}

#[async_trait]
impl Scanner for Semgrep {
    fn info(&self) -> ScannerInfo {
        ScannerInfo {
            id: "semgrep",
            display_name: "Semgrep (SAST)",
            category: Category::Sast,
            upstream_binary: "semgrep",
            install_hint: "pipx install semgrep  |  https://semgrep.dev/docs/cli",
            homepage: "https://semgrep.dev",
        }
    }

    fn supports(&self, target: &Target) -> bool {
        matches!(target, Target::Directory { .. })
    }

    fn check_installed(&self) -> InstallStatus {
        common::detect("semgrep", "semgrep", &["--version"])
    }

    async fn scan(&self, target: &Target, scan_id: &str, tx: ProgressTx) -> anyhow::Result<Vec<Finding>> {
        let Target::Directory { path } = target else {
            return Ok(vec![]);
        };
        let _ = tx.send(ScanEvent::Progress {
            scanner: "semgrep".into(),
            scan_id: scan_id.into(),
            pct: 0.05,
            message: Some("running semgrep ci rules".into()),
        });

        let path_str = path.to_string_lossy().to_string();
        let args = vec![
            "scan", "--json", "--quiet", "--no-error",
            "--config", "auto",
            "--timeout", "60",
            &path_str,
        ];
        let raw = common::run_capture("semgrep", &args, None).await?;
        if raw.trim().is_empty() {
            return Ok(vec![]);
        }
        let report: SemgrepReport = serde_json::from_str(&raw).unwrap_or(SemgrepReport { results: vec![] });

        let total = report.results.len().max(1);
        let mut findings = Vec::with_capacity(report.results.len());
        for (idx, r) in report.results.into_iter().enumerate() {
            let _ = tx.send(ScanEvent::Progress {
                scanner: "semgrep".into(),
                scan_id: scan_id.into(),
                pct: 0.1 + 0.9 * (idx as f32 / total as f32),
                message: None,
            });

            let severity = r.extra.severity.as_deref().map(Severity::from_str_loose).unwrap_or(Severity::Medium);
            let title = r.extra.message.clone().unwrap_or_else(|| r.check_id.clone());

            let mut cwe: Vec<String> = vec![];
            let mut refs: Vec<String> = vec![];
            if let Some(meta) = &r.extra.metadata {
                if let Some(cwes) = meta.get("cwe").and_then(|c| c.as_array()) {
                    for c in cwes {
                        if let Some(s) = c.as_str() {
                            cwe.push(s.to_string());
                        }
                    }
                } else if let Some(c) = meta.get("cwe").and_then(|c| c.as_str()) {
                    cwe.push(c.to_string());
                }
                if let Some(refs_arr) = meta.get("references").and_then(|r| r.as_array()) {
                    for c in refs_arr {
                        if let Some(s) = c.as_str() {
                            refs.push(s.to_string());
                        }
                    }
                }
            }

            let path_buf = Some(PathBuf::from(&r.path));
            let fingerprint = Finding::make_fingerprint(&r.check_id, path_buf.as_ref(), Some(r.start.line), &title);

            let finding = Finding {
                id: r.check_id.clone(),
                scanner: "semgrep".into(),
                category: Category::Sast,
                severity,
                cwe,
                title,
                description: r.extra.message.clone().unwrap_or_default(),
                location: Location {
                    path: path_buf,
                    start_line: Some(r.start.line),
                    end_line: Some(r.end.line),
                    snippet: r.extra.lines.clone(),
                },
                fix_suggestion: r.extra.fix.clone(),
                references: refs,
                fingerprint,
                raw: None,
            };
            let _ = tx.send(ScanEvent::Finding {
                scanner: "semgrep".into(),
                scan_id: scan_id.into(),
                finding: finding.clone(),
            });
            findings.push(finding);
        }
        Ok(findings)
    }
}
