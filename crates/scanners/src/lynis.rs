use crate::common;
use async_trait::async_trait;
use audit_core::{Category, Finding, InstallStatus, Location, ProgressTx, ScanEvent, Scanner, ScannerInfo, Severity, Target};

pub struct Lynis;

#[async_trait]
impl Scanner for Lynis {
    fn info(&self) -> ScannerInfo {
        ScannerInfo {
            id: "lynis",
            display_name: "Lynis (host hardening)",
            category: Category::HostHardening,
            upstream_binary: "lynis",
            install_hint: "brew install lynis  |  https://cisofy.com/lynis",
            homepage: "https://cisofy.com/lynis",
        }
    }

    fn supports(&self, target: &Target) -> bool {
        // Lynis runs locally; ssh-piped is out of scope for v1.
        matches!(target, Target::Directory { .. } | Target::SshHost { .. })
    }

    fn check_installed(&self) -> InstallStatus {
        common::detect("lynis", "lynis", &["--version"])
    }

    async fn scan(&self, _target: &Target, scan_id: &str, tx: ProgressTx) -> anyhow::Result<Vec<Finding>> {
        let _ = tx.send(ScanEvent::Progress {
            scanner: "lynis".into(),
            scan_id: scan_id.into(),
            pct: 0.05,
            message: Some("auditing local host".into()),
        });
        let args = vec!["audit", "system", "--quick", "--quiet"];
        let raw = common::run_capture("lynis", &args, None).await?;

        let mut findings = Vec::new();
        for line in raw.lines() {
            // Suggestion lines look like:  "Suggestion[xxx]: <text> [HARDEN-<id>]"
            if let Some(rest) = line.trim().strip_prefix("Suggestion") {
                let text = rest.trim_start_matches(|c: char| c == '[' || c.is_ascii_alphanumeric() || c == ']' || c == ':').trim();
                if text.is_empty() { continue; }
                let title = text.split('[').next().unwrap_or(text).trim().to_string();
                let rule_id = text.rsplit_once('[').map(|(_, r)| r.trim_end_matches(']').to_string()).unwrap_or_else(|| "lynis.suggestion".into());
                let fingerprint = Finding::make_fingerprint(&rule_id, None, None, &title);
                let finding = Finding {
                    id: rule_id,
                    scanner: "lynis".into(),
                    category: Category::HostHardening,
                    severity: Severity::Low,
                    cwe: vec![],
                    title,
                    description: text.to_string(),
                    location: Location { path: None, start_line: None, end_line: None, snippet: None },
                    fix_suggestion: None,
                    references: vec!["https://cisofy.com/lynis/controls/".into()],
                    fingerprint,
                    raw: None,
                };
                let _ = tx.send(ScanEvent::Finding {
                    scanner: "lynis".into(),
                    scan_id: scan_id.into(),
                    finding: finding.clone(),
                });
                findings.push(finding);
            }
        }
        Ok(findings)
    }
}
