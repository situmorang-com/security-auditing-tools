//! Wrappers around well-known upstream security tools. Every wrapper
//! implements `audit_core::Scanner` and translates the tool's native output
//! into the shared `Finding` schema.

use audit_core::Scanner;
use std::sync::Arc;

mod common;
pub mod checkov;
pub mod gitleaks;
pub mod lynis;
pub mod nmap;
pub mod nuclei;
pub mod semgrep;
pub mod trivy;

pub fn registry() -> Vec<Arc<dyn Scanner>> {
    vec![
        Arc::new(gitleaks::Gitleaks),
        Arc::new(semgrep::Semgrep),
        Arc::new(trivy::Trivy),
        Arc::new(checkov::Checkov),
        Arc::new(nuclei::Nuclei),
        Arc::new(nmap::Nmap),
        Arc::new(lynis::Lynis),
    ]
}
