use crate::common;
use async_trait::async_trait;
use audit_core::{Category, Finding, InstallStatus, Location, ProgressTx, ScanEvent, Scanner, ScannerInfo, Severity, Target};
use serde::Deserialize;
use std::path::PathBuf;

pub struct Gitleaks;

#[derive(Debug, Deserialize)]
struct GitleaksFinding {
    #[serde(rename = "RuleID")]
    rule_id: String,
    #[serde(rename = "Description")]
    description: Option<String>,
    #[serde(rename = "File")]
    file: Option<String>,
    #[serde(rename = "StartLine")]
    start_line: Option<u32>,
    #[serde(rename = "EndLine")]
    end_line: Option<u32>,
    #[serde(rename = "Match")]
    r#match: Option<String>,
    #[serde(rename = "Secret")]
    secret: Option<String>,
}

#[async_trait]
impl Scanner for Gitleaks {
    fn info(&self) -> ScannerInfo {
        ScannerInfo {
            id: "gitleaks",
            display_name: "Gitleaks (secrets)",
            category: Category::Secrets,
            upstream_binary: "gitleaks",
            install_hint: "brew install gitleaks  |  https://github.com/gitleaks/gitleaks",
            homepage: "https://github.com/gitleaks/gitleaks",
        }
    }

    fn supports(&self, target: &Target) -> bool {
        matches!(target, Target::Directory { .. })
    }

    fn check_installed(&self) -> InstallStatus {
        common::detect("gitleaks", "gitleaks", &["version"])
    }

    async fn scan(&self, target: &Target, scan_id: &str, tx: ProgressTx) -> anyhow::Result<Vec<Finding>> {
        let Target::Directory { path } = target else {
            return Ok(vec![]);
        };
        let _ = tx.send(ScanEvent::Progress {
            scanner: "gitleaks".into(),
            scan_id: scan_id.into(),
            pct: 0.05,
            message: Some("scanning for committed secrets".into()),
        });

        let report = std::env::temp_dir().join(format!("gitleaks-{scan_id}.json"));
        let path_str = path.to_string_lossy().to_string();
        let report_str = report.to_string_lossy().to_string();
        let args = vec![
            "detect",
            "--no-banner",
            "--report-format", "json",
            "--report-path", &report_str,
            "--source", &path_str,
            "--exit-code", "0",
        ];
        let _ = common::run_capture("gitleaks", &args, None).await?;

        let raw = match tokio::fs::read_to_string(&report).await {
            Ok(s) if !s.trim().is_empty() => s,
            _ => return Ok(vec![]),
        };
        let _ = tokio::fs::remove_file(&report).await;

        let parsed: Vec<GitleaksFinding> = serde_json::from_str(&raw).unwrap_or_default();
        let mut findings = Vec::with_capacity(parsed.len());

        for (idx, gf) in parsed.into_iter().enumerate() {
            let total = findings.capacity().max(1);
            let _ = tx.send(ScanEvent::Progress {
                scanner: "gitleaks".into(),
                scan_id: scan_id.into(),
                pct: 0.1 + 0.9 * (idx as f32 / total as f32),
                message: None,
            });

            let path_buf = gf.file.as_ref().map(PathBuf::from);
            let title = gf.description.clone().unwrap_or_else(|| gf.rule_id.clone());
            let fingerprint = Finding::make_fingerprint(&gf.rule_id, path_buf.as_ref(), gf.start_line, &title);

            // Don't store the raw secret value — only that one exists.
            let snippet = gf.r#match.as_ref().map(|m| redact(m));
            let secret_redacted = gf.secret.as_ref().map(|s| redact(s));

            let finding = Finding {
                id: gf.rule_id.clone(),
                scanner: "gitleaks".into(),
                category: Category::Secrets,
                severity: Severity::High,
                cwe: vec!["CWE-798".into()],
                title,
                description: format!(
                    "Gitleaks rule `{}` matched. {}",
                    gf.rule_id,
                    secret_redacted.as_deref().unwrap_or("Inspect the file and rotate the credential immediately.")
                ),
                location: Location {
                    path: path_buf,
                    start_line: gf.start_line,
                    end_line: gf.end_line,
                    snippet,
                },
                fix_suggestion: Some(
                    "1) Rotate the credential at the issuing provider. 2) Remove from git history (git filter-repo or BFG). 3) Move the secret to a vault or `.env` that is gitignored."
                        .into(),
                ),
                references: vec!["https://cwe.mitre.org/data/definitions/798.html".into()],
                fingerprint,
                raw: None,
            };
            let _ = tx.send(ScanEvent::Finding {
                scanner: "gitleaks".into(),
                scan_id: scan_id.into(),
                finding: finding.clone(),
            });
            findings.push(finding);
        }

        Ok(findings)
    }
}

fn redact(s: &str) -> String {
    if s.len() <= 6 {
        "***".into()
    } else {
        format!("{}***{}", &s[..3], &s[s.len() - 2..])
    }
}
