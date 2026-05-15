use crate::common;
use async_trait::async_trait;
use audit_core::{Category, Finding, InstallStatus, Location, ProgressTx, ScanEvent, Scanner, ScannerInfo, Severity, Target};
use regex::Regex;

pub struct Nmap;

#[async_trait]
impl Scanner for Nmap {
    fn info(&self) -> ScannerInfo {
        ScannerInfo {
            id: "nmap",
            display_name: "Nmap (network)",
            category: Category::Network,
            upstream_binary: "nmap",
            install_hint: "brew install nmap  |  https://nmap.org",
            homepage: "https://nmap.org",
        }
    }

    fn supports(&self, target: &Target) -> bool {
        matches!(target, Target::SshHost { .. } | Target::Url { .. })
    }

    fn check_installed(&self) -> InstallStatus {
        common::detect("nmap", "nmap", &["--version"])
    }

    async fn scan(&self, target: &Target, scan_id: &str, tx: ProgressTx) -> anyhow::Result<Vec<Finding>> {
        let host = match target {
            Target::SshHost { host, .. } => host.clone(),
            Target::Url { url } => url
                .trim_start_matches("https://")
                .trim_start_matches("http://")
                .split('/')
                .next()
                .unwrap_or(url)
                .to_string(),
            _ => return Ok(vec![]),
        };
        let _ = tx.send(ScanEvent::Progress {
            scanner: "nmap".into(),
            scan_id: scan_id.into(),
            pct: 0.05,
            message: Some(format!("nmap -sV {host}")),
        });
        // Top-100 + service detection, no privileged scans by default.
        let args = vec!["-T4", "-F", "-sV", "--open", &host];
        let raw = common::run_capture("nmap", &args, None).await?;

        // Parse lines like: "22/tcp open  ssh OpenSSH 8.9p1"
        let re = Regex::new(r"^(?P<port>\d+)/(?P<proto>tcp|udp)\s+(?P<state>\w+)\s+(?P<service>\S+)(?:\s+(?P<banner>.*))?$").unwrap();
        let mut findings = Vec::new();
        for line in raw.lines() {
            let Some(cap) = re.captures(line.trim()) else { continue };
            let port = &cap["port"];
            let service = &cap["service"];
            let banner = cap.name("banner").map(|m| m.as_str().trim()).unwrap_or("");
            let title = format!("Open port {port}/{} — {service}", &cap["proto"]);
            let severity = match port {
                "23" | "21" | "445" | "3389" => Severity::High, // telnet/ftp/smb/rdp
                "80" | "8080" => Severity::Low,
                _ => Severity::Info,
            };
            let fingerprint = Finding::make_fingerprint("nmap-open", None, Some(port.parse().unwrap_or(0)), &title);
            let finding = Finding {
                id: format!("nmap.open.{port}"),
                scanner: "nmap".into(),
                category: Category::Network,
                severity,
                cwe: vec![],
                title,
                description: if banner.is_empty() {
                    "Open service detected. Confirm it is required and exposed only to trusted networks.".into()
                } else {
                    format!("Banner: {banner}")
                },
                location: Location { path: None, start_line: None, end_line: None, snippet: Some(host.clone()) },
                fix_suggestion: Some("If this service is not required externally, restrict it via firewall/security group.".into()),
                references: vec![],
                fingerprint,
                raw: None,
            };
            let _ = tx.send(ScanEvent::Finding {
                scanner: "nmap".into(),
                scan_id: scan_id.into(),
                finding: finding.clone(),
            });
            findings.push(finding);
        }
        Ok(findings)
    }
}
