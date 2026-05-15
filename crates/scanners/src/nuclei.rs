use crate::common;
use async_trait::async_trait;
use audit_core::{Category, Finding, InstallStatus, Location, ProgressTx, ScanEvent, Scanner, ScannerInfo, Severity, Target};
use serde::Deserialize;

pub struct Nuclei;

#[derive(Debug, Deserialize)]
struct NucleiLine {
    #[serde(rename = "template-id")]
    template_id: String,
    info: NucleiInfo,
    #[serde(rename = "matched-at")]
    matched_at: Option<String>,
}

#[derive(Debug, Deserialize)]
struct NucleiInfo {
    name: String,
    severity: Option<String>,
    description: Option<String>,
    #[serde(default)]
    reference: Vec<String>,
    #[serde(default)]
    tags: Vec<String>,
    classification: Option<NucleiClassification>,
}

#[derive(Debug, Deserialize)]
struct NucleiClassification {
    #[serde(rename = "cwe-id", default)]
    cwe_id: Vec<String>,
}

#[async_trait]
impl Scanner for Nuclei {
    fn info(&self) -> ScannerInfo {
        ScannerInfo {
            id: "nuclei",
            display_name: "Nuclei (DAST)",
            category: Category::Dast,
            upstream_binary: "nuclei",
            install_hint: "brew install nuclei  |  https://nuclei.projectdiscovery.io",
            homepage: "https://nuclei.projectdiscovery.io",
        }
    }

    fn supports(&self, target: &Target) -> bool {
        matches!(target, Target::Url { .. })
    }

    fn check_installed(&self) -> InstallStatus {
        common::detect("nuclei", "nuclei", &["-version"])
    }

    async fn scan(&self, target: &Target, scan_id: &str, tx: ProgressTx) -> anyhow::Result<Vec<Finding>> {
        let Target::Url { url } = target else {
            return Ok(vec![]);
        };
        let _ = tx.send(ScanEvent::Progress {
            scanner: "nuclei".into(),
            scan_id: scan_id.into(),
            pct: 0.05,
            message: Some("running nuclei templates".into()),
        });
        let args = vec!["-u", url, "-jsonl", "-silent", "-disable-update-check"];
        let raw = common::run_capture("nuclei", &args, None).await?;
        let mut findings = Vec::new();
        for line in raw.lines() {
            let Ok(n) = serde_json::from_str::<NucleiLine>(line) else { continue };
            let severity = n.info.severity.as_deref().map(audit_core::Severity::from_str_loose).unwrap_or(Severity::Medium);
            let fingerprint = Finding::make_fingerprint(&n.template_id, None, None, &n.info.name);
            let finding = Finding {
                id: n.template_id.clone(),
                scanner: "nuclei".into(),
                category: Category::Dast,
                severity,
                cwe: n.info.classification.map(|c| c.cwe_id).unwrap_or_default(),
                title: n.info.name,
                description: n.info.description.unwrap_or_default(),
                location: Location {
                    path: None,
                    start_line: None,
                    end_line: None,
                    snippet: n.matched_at,
                },
                fix_suggestion: None,
                references: n.info.reference,
                fingerprint,
                raw: None,
            };
            let _ = tx.send(ScanEvent::Finding {
                scanner: "nuclei".into(),
                scan_id: scan_id.into(),
                finding: finding.clone(),
            });
            findings.push(finding);
        }
        Ok(findings)
    }
}
