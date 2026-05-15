//! Common types shared across every scanner, the orchestrator, reporters, and
//! the Tauri command layer. The `Scanner` trait is the integration seam.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use tokio::sync::mpsc;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash, PartialOrd, Ord)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Info,
    Low,
    Medium,
    High,
    Critical,
}

impl Severity {
    pub fn from_str_loose(s: &str) -> Self {
        match s.to_ascii_lowercase().as_str() {
            "critical" | "crit" => Self::Critical,
            "high" | "error" => Self::High,
            "medium" | "moderate" | "warning" | "warn" => Self::Medium,
            "low" | "minor" => Self::Low,
            _ => Self::Info,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "kebab-case")]
pub enum Category {
    Sast,
    Sca,
    Secrets,
    Iac,
    Container,
    Dast,
    Network,
    HostHardening,
    Cloud,
}

impl Category {
    pub fn label(&self) -> &'static str {
        match self {
            Self::Sast => "Static Code (SAST)",
            Self::Sca => "Dependencies (SCA)",
            Self::Secrets => "Secret Leakage",
            Self::Iac => "Infrastructure-as-Code",
            Self::Container => "Container Images",
            Self::Dast => "Live Web App (DAST)",
            Self::Network => "Network",
            Self::HostHardening => "Host Hardening",
            Self::Cloud => "Cloud Posture",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Location {
    pub path: Option<PathBuf>,
    pub start_line: Option<u32>,
    pub end_line: Option<u32>,
    pub snippet: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Finding {
    pub id: String,
    pub scanner: String,
    pub category: Category,
    pub severity: Severity,
    pub cwe: Vec<String>,
    pub title: String,
    pub description: String,
    pub location: Location,
    pub fix_suggestion: Option<String>,
    pub references: Vec<String>,
    /// Stable cross-scanner identity for dedup.
    pub fingerprint: String,
    pub raw: Option<serde_json::Value>,
}

impl Finding {
    /// Compute a fingerprint from the bits that uniquely identify the issue,
    /// independent of which tool reported it.
    pub fn make_fingerprint(rule_id: &str, path: Option<&PathBuf>, line: Option<u32>, title: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(rule_id.as_bytes());
        hasher.update(b"|");
        if let Some(p) = path {
            hasher.update(p.to_string_lossy().as_bytes());
        }
        hasher.update(b"|");
        if let Some(l) = line {
            hasher.update(l.to_be_bytes());
        }
        hasher.update(b"|");
        hasher.update(title.as_bytes());
        hex::encode(&hasher.finalize()[..12])
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum Target {
    /// A local directory (repo). The most common target.
    Directory { path: PathBuf },
    /// A live URL for DAST.
    Url { url: String },
    /// A container image reference (e.g. "alpine:3.19").
    ContainerImage { image: String },
    /// A host reachable over SSH for hardening checks.
    SshHost { host: String, user: String },
}

impl Target {
    pub fn label(&self) -> String {
        match self {
            Self::Directory { path } => format!("dir: {}", path.display()),
            Self::Url { url } => format!("url: {url}"),
            Self::ContainerImage { image } => format!("image: {image}"),
            Self::SshHost { host, user } => format!("ssh: {user}@{host}"),
        }
    }
}

/// Progress events streamed from a scanner up to the orchestrator and (via
/// Tauri events) on to the UI for live animation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum ScanEvent {
    Started { scanner: String, scan_id: String },
    Progress { scanner: String, scan_id: String, pct: f32, message: Option<String> },
    Finding { scanner: String, scan_id: String, finding: Finding },
    Finished { scanner: String, scan_id: String, found: usize },
    Failed { scanner: String, scan_id: String, error: String },
}

pub type ProgressTx = mpsc::UnboundedSender<ScanEvent>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScannerInfo {
    pub id: &'static str,
    pub display_name: &'static str,
    pub category: Category,
    pub upstream_binary: &'static str,
    pub install_hint: &'static str,
    pub homepage: &'static str,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallStatus {
    pub scanner_id: String,
    pub installed: bool,
    pub version: Option<String>,
    pub binary_path: Option<PathBuf>,
}

#[async_trait]
pub trait Scanner: Send + Sync {
    fn info(&self) -> ScannerInfo;

    /// Is this scanner applicable to the target?
    fn supports(&self, target: &Target) -> bool;

    /// Check whether the upstream binary is on PATH and what version.
    fn check_installed(&self) -> InstallStatus;

    /// Run the scan. Emits events through `tx`. Returns the final findings vec
    /// (also already emitted as `ScanEvent::Finding`).
    async fn scan(&self, target: &Target, scan_id: &str, tx: ProgressTx) -> anyhow::Result<Vec<Finding>>;
}

#[derive(Debug, thiserror::Error)]
pub enum AuditError {
    #[error("scanner binary not installed: {0}")]
    NotInstalled(String),
    #[error("scanner produced unparseable output: {0}")]
    ParseError(String),
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    #[error("json: {0}")]
    Json(#[from] serde_json::Error),
    #[error(transparent)]
    Other(#[from] anyhow::Error),
}
