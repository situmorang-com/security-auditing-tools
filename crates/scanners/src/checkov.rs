use crate::common;
use async_trait::async_trait;
use audit_core::{Category, Finding, InstallStatus, Location, ProgressTx, ScanEvent, Scanner, ScannerInfo, Severity, Target};
use serde::Deserialize;
use std::path::PathBuf;

pub struct Checkov;

#[derive(Debug, Deserialize)]
struct CheckovReport {
    #[serde(default)]
    results: CheckovResults,
}

#[derive(Debug, Deserialize, Default)]
struct CheckovResults {
    #[serde(default)]
    failed_checks: Vec<CheckovCheck>,
}

#[derive(Debug, Deserialize)]
struct CheckovCheck {
    check_id: String,
    check_name: String,
    file_path: String,
    file_line_range: Option<(u32, u32)>,
    guideline: Option<String>,
    severity: Option<String>,
}

#[async_trait]
impl Scanner for Checkov {
    fn info(&self) -> ScannerInfo {
        ScannerInfo {
            id: "checkov",
            display_name: "Checkov (IaC deep)",
            category: Category::Iac,
            upstream_binary: "checkov",
            install_hint: "pipx install checkov  |  https://www.checkov.io",
            homepage: "https://www.checkov.io",
        }
    }

    fn supports(&self, target: &Target) -> bool {
        matches!(target, Target::Directory { .. })
    }

    fn check_installed(&self) -> InstallStatus {
        common::detect("checkov", "checkov", &["--version"])
    }

    async fn scan(&self, target: &Target, scan_id: &str, tx: ProgressTx) -> anyhow::Result<Vec<Finding>> {
        let Target::Directory { path } = target else {
            return Ok(vec![]);
        };
        let _ = tx.send(ScanEvent::Progress {
            scanner: "checkov".into(),
            scan_id: scan_id.into(),
            pct: 0.05,
            message: Some("running checkov".into()),
        });
        let path_str = path.to_string_lossy().to_string();
        let args = vec!["-d", &path_str, "-o", "json", "--quiet", "--compact"];
        let raw = common::run_capture("checkov", &args, None).await?;
        if raw.trim().is_empty() {
            return Ok(vec![]);
        }
        // Checkov returns either an object or an array of reports.
        let reports: Vec<CheckovReport> = match serde_json::from_str::<Vec<CheckovReport>>(&raw) {
            Ok(v) => v,
            Err(_) => match serde_json::from_str::<CheckovReport>(&raw) {
                Ok(r) => vec![r],
                Err(_) => return Ok(vec![]),
            },
        };

        let mut findings = Vec::new();
        for r in reports {
            for c in r.results.failed_checks {
                let severity = c.severity.as_deref().map(Severity::from_str_loose).unwrap_or(Severity::Medium);
                let path_buf = Some(PathBuf::from(&c.file_path));
                let (start, end) = c.file_line_range.map(|(a, b)| (Some(a), Some(b))).unwrap_or((None, None));
                let fingerprint = Finding::make_fingerprint(&c.check_id, path_buf.as_ref(), start, &c.check_name);
                let finding = Finding {
                    id: c.check_id,
                    scanner: "checkov".into(),
                    category: Category::Iac,
                    severity,
                    cwe: vec![],
                    title: c.check_name,
                    description: c.guideline.clone().unwrap_or_default(),
                    location: Location { path: path_buf, start_line: start, end_line: end, snippet: None },
                    fix_suggestion: c.guideline,
                    references: vec![],
                    fingerprint,
                    raw: None,
                };
                let _ = tx.send(ScanEvent::Finding {
                    scanner: "checkov".into(),
                    scan_id: scan_id.into(),
                    finding: finding.clone(),
                });
                findings.push(finding);
            }
        }
        Ok(findings)
    }
}
