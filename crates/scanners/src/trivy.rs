use crate::common;
use async_trait::async_trait;
use audit_core::{Category, Finding, InstallStatus, Location, ProgressTx, ScanEvent, Scanner, ScannerInfo, Severity, Target};
use serde::Deserialize;
use std::path::PathBuf;

pub struct Trivy;

#[derive(Debug, Deserialize)]
struct TrivyReport {
    #[serde(rename = "Results", default)]
    results: Vec<TrivyResult>,
}

#[derive(Debug, Deserialize)]
struct TrivyResult {
    #[serde(rename = "Target")]
    target: String,
    #[serde(rename = "Class", default)]
    class: Option<String>,
    #[serde(rename = "Vulnerabilities", default)]
    vulnerabilities: Vec<TrivyVuln>,
    #[serde(rename = "Misconfigurations", default)]
    misconfigurations: Vec<TrivyMisconfig>,
    #[serde(rename = "Secrets", default)]
    secrets: Vec<TrivySecret>,
}

#[derive(Debug, Deserialize)]
struct TrivyVuln {
    #[serde(rename = "VulnerabilityID")]
    id: String,
    #[serde(rename = "PkgName")]
    pkg_name: String,
    #[serde(rename = "InstalledVersion")]
    installed_version: Option<String>,
    #[serde(rename = "FixedVersion")]
    fixed_version: Option<String>,
    #[serde(rename = "Title")]
    title: Option<String>,
    #[serde(rename = "Description")]
    description: Option<String>,
    #[serde(rename = "Severity")]
    severity: Option<String>,
    #[serde(rename = "PrimaryURL")]
    primary_url: Option<String>,
    #[serde(rename = "CweIDs", default)]
    cwe_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct TrivyMisconfig {
    #[serde(rename = "ID")]
    id: String,
    #[serde(rename = "Title")]
    title: String,
    #[serde(rename = "Description")]
    description: Option<String>,
    #[serde(rename = "Severity")]
    severity: Option<String>,
    #[serde(rename = "Resolution")]
    resolution: Option<String>,
    #[serde(rename = "PrimaryURL")]
    primary_url: Option<String>,
    #[serde(rename = "CauseMetadata", default)]
    cause: Option<CauseMetadata>,
}

#[derive(Debug, Deserialize, Default)]
struct CauseMetadata {
    #[serde(rename = "StartLine")]
    start_line: Option<u32>,
    #[serde(rename = "EndLine")]
    end_line: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct TrivySecret {
    #[serde(rename = "RuleID")]
    rule_id: String,
    #[serde(rename = "Title")]
    title: String,
    #[serde(rename = "Severity")]
    severity: Option<String>,
    #[serde(rename = "StartLine")]
    start_line: Option<u32>,
    #[serde(rename = "EndLine")]
    end_line: Option<u32>,
}

#[async_trait]
impl Scanner for Trivy {
    fn info(&self) -> ScannerInfo {
        ScannerInfo {
            id: "trivy",
            display_name: "Trivy (SCA / IaC / container)",
            category: Category::Sca,
            upstream_binary: "trivy",
            install_hint: "brew install trivy  |  https://trivy.dev",
            homepage: "https://trivy.dev",
        }
    }

    fn supports(&self, target: &Target) -> bool {
        matches!(target, Target::Directory { .. } | Target::ContainerImage { .. })
    }

    fn check_installed(&self) -> InstallStatus {
        common::detect("trivy", "trivy", &["--version"])
    }

    async fn scan(&self, target: &Target, scan_id: &str, tx: ProgressTx) -> anyhow::Result<Vec<Finding>> {
        let _ = tx.send(ScanEvent::Progress {
            scanner: "trivy".into(),
            scan_id: scan_id.into(),
            pct: 0.05,
            message: Some("invoking trivy".into()),
        });

        let (mode, target_str) = match target {
            Target::Directory { path } => ("fs", path.to_string_lossy().to_string()),
            Target::ContainerImage { image } => ("image", image.clone()),
            _ => return Ok(vec![]),
        };

        let args = vec![
            mode,
            "--quiet",
            "--scanners", "vuln,secret,misconfig",
            "--format", "json",
            "--exit-code", "0",
            &target_str,
        ];
        let raw = common::run_capture("trivy", &args, None).await?;
        if raw.trim().is_empty() {
            return Ok(vec![]);
        }
        let report: TrivyReport = match serde_json::from_str(&raw) {
            Ok(r) => r,
            Err(_) => return Ok(vec![]),
        };

        let mut findings = Vec::new();
        for r in report.results {
            let path_buf = Some(PathBuf::from(&r.target));
            let category = match r.class.as_deref() {
                Some("config") => Category::Iac,
                Some("secret") => Category::Secrets,
                Some("os-pkgs") | Some("lang-pkgs") => match target {
                    Target::ContainerImage { .. } => Category::Container,
                    _ => Category::Sca,
                },
                _ => Category::Sca,
            };

            for v in r.vulnerabilities {
                let severity = v.severity.as_deref().map(Severity::from_str_loose).unwrap_or(Severity::Medium);
                let title = v.title.clone().unwrap_or_else(|| format!("{} in {}", v.id, v.pkg_name));
                let fingerprint = Finding::make_fingerprint(&v.id, path_buf.as_ref(), None, &v.pkg_name);
                let mut description = v.description.clone().unwrap_or_default();
                if let (Some(installed), Some(fixed)) = (&v.installed_version, &v.fixed_version) {
                    description.push_str(&format!("\n\nInstalled: {installed}\nFixed in: {fixed}"));
                }

                let finding = Finding {
                    id: v.id.clone(),
                    scanner: "trivy".into(),
                    category,
                    severity,
                    cwe: v.cwe_ids,
                    title,
                    description,
                    location: Location {
                        path: path_buf.clone(),
                        start_line: None,
                        end_line: None,
                        snippet: Some(format!("{} {}", v.pkg_name, v.installed_version.unwrap_or_default())),
                    },
                    fix_suggestion: v.fixed_version.as_ref().map(|fv| format!("Upgrade `{}` to {} or later.", v.pkg_name, fv)),
                    references: v.primary_url.into_iter().collect(),
                    fingerprint,
                    raw: None,
                };
                let _ = tx.send(ScanEvent::Finding {
                    scanner: "trivy".into(),
                    scan_id: scan_id.into(),
                    finding: finding.clone(),
                });
                findings.push(finding);
            }

            for m in r.misconfigurations {
                let severity = m.severity.as_deref().map(Severity::from_str_loose).unwrap_or(Severity::Medium);
                let (start, end) = m.cause.map(|c| (c.start_line, c.end_line)).unwrap_or((None, None));
                let fingerprint = Finding::make_fingerprint(&m.id, path_buf.as_ref(), start, &m.title);
                let finding = Finding {
                    id: m.id,
                    scanner: "trivy".into(),
                    category: Category::Iac,
                    severity,
                    cwe: vec![],
                    title: m.title,
                    description: m.description.unwrap_or_default(),
                    location: Location {
                        path: path_buf.clone(),
                        start_line: start,
                        end_line: end,
                        snippet: None,
                    },
                    fix_suggestion: m.resolution,
                    references: m.primary_url.into_iter().collect(),
                    fingerprint,
                    raw: None,
                };
                let _ = tx.send(ScanEvent::Finding {
                    scanner: "trivy".into(),
                    scan_id: scan_id.into(),
                    finding: finding.clone(),
                });
                findings.push(finding);
            }

            for s in r.secrets {
                let severity = s.severity.as_deref().map(Severity::from_str_loose).unwrap_or(Severity::High);
                let fingerprint = Finding::make_fingerprint(&s.rule_id, path_buf.as_ref(), s.start_line, &s.title);
                let finding = Finding {
                    id: s.rule_id,
                    scanner: "trivy".into(),
                    category: Category::Secrets,
                    severity,
                    cwe: vec!["CWE-798".into()],
                    title: s.title,
                    description: "Trivy secret-scan match. Rotate the credential and remove from history.".into(),
                    location: Location {
                        path: path_buf.clone(),
                        start_line: s.start_line,
                        end_line: s.end_line,
                        snippet: None,
                    },
                    fix_suggestion: Some("Rotate the credential; move to a vault.".into()),
                    references: vec!["https://cwe.mitre.org/data/definitions/798.html".into()],
                    fingerprint,
                    raw: None,
                };
                let _ = tx.send(ScanEvent::Finding {
                    scanner: "trivy".into(),
                    scan_id: scan_id.into(),
                    finding: finding.clone(),
                });
                findings.push(finding);
            }
        }
        Ok(findings)
    }
}
