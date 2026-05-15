//! Drives multiple scanners against a single target, fans out events to one
//! channel, and computes a deduplicated aggregate result.

use audit_core::{Finding, InstallStatus, ScanEvent, Scanner, ScannerInfo, Target};
use chrono::{DateTime, Utc};
use futures::future::join_all;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::mpsc;

pub use audit_scanners::registry;

#[derive(Debug, Clone, Serialize)]
pub struct AuditRun {
    pub id: String,
    pub started_at: DateTime<Utc>,
    pub finished_at: Option<DateTime<Utc>>,
    pub target_label: String,
    pub findings: Vec<Finding>,
    pub per_scanner: HashMap<String, ScannerOutcome>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ScannerOutcome {
    pub info: ScannerInfo,
    pub install: InstallStatus,
    pub findings_count: usize,
    pub error: Option<String>,
    pub duration_ms: u128,
}

pub struct Orchestrator {
    pub scanners: Vec<Arc<dyn Scanner>>,
}

impl Default for Orchestrator {
    fn default() -> Self {
        Self { scanners: registry() }
    }
}

impl Orchestrator {
    pub fn preflight(&self) -> Vec<(ScannerInfo, InstallStatus)> {
        self.scanners
            .iter()
            .map(|s| (s.info(), s.check_installed()))
            .collect()
    }

    /// Run every applicable, installed scanner concurrently against the target.
    /// Events are forwarded over `event_tx` for the UI; final aggregate is
    /// returned when all scanners are finished.
    pub async fn run(
        &self,
        target: Target,
        event_tx: mpsc::UnboundedSender<ScanEvent>,
    ) -> AuditRun {
        let run_id = nano_id();
        let started_at = Utc::now();
        let target_label = target.label();

        let applicable: Vec<Arc<dyn Scanner>> = self
            .scanners
            .iter()
            .filter(|s| s.supports(&target))
            .cloned()
            .collect();

        let target = Arc::new(target);
        let tasks = applicable.into_iter().map(|scanner| {
            let target = Arc::clone(&target);
            let tx = event_tx.clone();
            let scan_id = format!("{}-{}", run_id, scanner.info().id);
            async move {
                let info = scanner.info();
                let install = scanner.check_installed();
                let start = std::time::Instant::now();

                if !install.installed {
                    let id_str = info.id.to_string();
                    let err = format!("{} not installed", info.upstream_binary);
                    let _ = tx.send(ScanEvent::Failed {
                        scanner: id_str.clone(),
                        scan_id: scan_id.clone(),
                        error: err.clone(),
                    });
                    return (
                        id_str,
                        ScannerOutcome {
                            info,
                            install,
                            findings_count: 0,
                            error: Some(err),
                            duration_ms: start.elapsed().as_millis(),
                        },
                        Vec::<Finding>::new(),
                    );
                }

                let _ = tx.send(ScanEvent::Started {
                    scanner: info.id.to_string(),
                    scan_id: scan_id.clone(),
                });

                let result = scanner.scan(&target, &scan_id, tx.clone()).await;
                let duration_ms = start.elapsed().as_millis();

                match result {
                    Ok(findings) => {
                        let count = findings.len();
                        let _ = tx.send(ScanEvent::Finished {
                            scanner: info.id.to_string(),
                            scan_id: scan_id.clone(),
                            found: count,
                        });
                        (
                            info.id.to_string(),
                            ScannerOutcome {
                                info,
                                install,
                                findings_count: count,
                                error: None,
                                duration_ms,
                            },
                            findings,
                        )
                    }
                    Err(e) => {
                        let _ = tx.send(ScanEvent::Failed {
                            scanner: info.id.to_string(),
                            scan_id: scan_id.clone(),
                            error: e.to_string(),
                        });
                        (
                            info.id.to_string(),
                            ScannerOutcome {
                                info,
                                install,
                                findings_count: 0,
                                error: Some(e.to_string()),
                                duration_ms,
                            },
                            Vec::new(),
                        )
                    }
                }
            }
        });

        let results = join_all(tasks).await;

        let mut per_scanner = HashMap::new();
        let mut findings: Vec<Finding> = Vec::new();
        for (id, outcome, mut f) in results {
            per_scanner.insert(id, outcome);
            findings.append(&mut f);
        }

        let findings = dedup(findings);

        AuditRun {
            id: run_id,
            started_at,
            finished_at: Some(Utc::now()),
            target_label,
            findings,
            per_scanner,
        }
    }
}

/// Same-fingerprint findings collapse, keeping the highest-severity copy and
/// merging references.
fn dedup(findings: Vec<Finding>) -> Vec<Finding> {
    let mut map: HashMap<String, Finding> = HashMap::new();
    for f in findings {
        let key = f.fingerprint.clone();
        map.entry(key)
            .and_modify(|existing| {
                if f.severity > existing.severity {
                    existing.severity = f.severity;
                }
                for r in &f.references {
                    if !existing.references.contains(r) {
                        existing.references.push(r.clone());
                    }
                }
            })
            .or_insert(f);
    }
    let mut out: Vec<Finding> = map.into_values().collect();
    out.sort_by(|a, b| b.severity.cmp(&a.severity).then(a.scanner.cmp(&b.scanner)));
    out
}

fn nano_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let ts = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_micros();
    format!("{ts:x}")
}
