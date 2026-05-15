//! Curated hardening tips. Each tip is linkable from a finding (via `applies_to`
//! tags) or browseable as a standalone library entry in the UI.

use audit_core::{Category, Severity};
use once_cell::sync::Lazy;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct Tip {
    pub id: &'static str,
    pub title: &'static str,
    pub category: Category,
    pub severity_floor: Severity,
    pub summary: &'static str,
    pub steps: &'static [&'static str],
    pub applies_to: &'static [&'static str],
    pub references: &'static [&'static str],
}

pub static TIPS: Lazy<Vec<Tip>> = Lazy::new(|| {
    vec![
        Tip {
            id: "secrets.rotate",
            title: "Rotate any committed secrets immediately",
            category: Category::Secrets,
            severity_floor: Severity::High,
            summary: "Once a credential touches a git history, treat it as public.",
            steps: &[
                "Identify the issuing provider (AWS, GitHub, Stripe, etc.) and revoke the credential there first.",
                "Issue a fresh credential and roll it out to consumers via your secret manager.",
                "Purge the secret from history with git-filter-repo or BFG, then force-push to all remotes.",
                "Add the offending path to .gitignore and to your pre-commit hook (gitleaks protect).",
            ],
            applies_to: &["gitleaks", "trivy:secret"],
            references: &[
                "https://docs.github.com/en/code-security/secret-scanning",
                "https://cwe.mitre.org/data/definitions/798.html",
            ],
        },
        Tip {
            id: "deps.upgrade",
            title: "Patch known-vulnerable dependencies",
            category: Category::Sca,
            severity_floor: Severity::Medium,
            summary: "Upgrade to the fixed version, or pin to an unaffected patch line.",
            steps: &[
                "Read the advisory's affected version range — the install might be unaffected.",
                "Bump in the lockfile (cargo update -p pkg, npm update pkg, etc.).",
                "Re-run tests; check for breaking changes in the changelog.",
                "If no fix exists, look for a maintained fork or vendor a patch — and add a SECURITY.md TODO.",
            ],
            applies_to: &["trivy:vuln", "osv"],
            references: &[
                "https://owasp.org/Top10/A06_2021-Vulnerable_and_Outdated_Components/",
            ],
        },
        Tip {
            id: "sast.input-validation",
            title: "Validate and parameterize all external input",
            category: Category::Sast,
            severity_floor: Severity::High,
            summary: "Injection bugs (SQL, command, XPath) all stem from concatenating untrusted input.",
            steps: &[
                "Use parameterized queries / prepared statements — never string-concat into SQL.",
                "Prefer typed parsers (serde, pydantic, zod) over manual string splitting.",
                "Validate at the trust boundary, not deep inside business logic.",
                "Where you must execute external strings, allowlist the operations (no `shell=True`).",
            ],
            applies_to: &["semgrep:sqli", "semgrep:command-injection", "cwe:89", "cwe:78"],
            references: &[
                "https://cheatsheetseries.owasp.org/cheatsheets/Injection_Prevention_Cheat_Sheet.html",
            ],
        },
        Tip {
            id: "iac.least-privilege",
            title: "Apply least-privilege to IAM and security groups",
            category: Category::Iac,
            severity_floor: Severity::High,
            summary: "Most cloud breaches come from over-broad IAM, not from zero-days.",
            steps: &[
                "Replace `*` actions with the exact API calls needed; use IAM Access Analyzer to confirm usage.",
                "Scope resources by ARN, not by `*`.",
                "Avoid `0.0.0.0/0` ingress except on intended public endpoints; lock SSH/RDP to bastion CIDRs.",
                "Enable CloudTrail / audit logging on every account from day one.",
            ],
            applies_to: &["checkov:iam", "trivy:iac", "cwe:732"],
            references: &[
                "https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html",
            ],
        },
        Tip {
            id: "container.no-root",
            title: "Don't run containers as root",
            category: Category::Container,
            severity_floor: Severity::Medium,
            summary: "A breakout from a root container is a breakout to the host.",
            steps: &[
                "Add `USER 1001` (or any non-zero UID) near the end of your Dockerfile.",
                "Make app paths writable for that UID at build time, not at runtime.",
                "Set `securityContext.runAsNonRoot: true` and `readOnlyRootFilesystem: true` in k8s.",
                "Drop all Linux capabilities and re-add only what you need.",
            ],
            applies_to: &["trivy:dockerfile", "checkov:dockerfile"],
            references: &[
                "https://docs.docker.com/develop/security-best-practices/",
            ],
        },
        Tip {
            id: "dast.headers",
            title: "Set the security-header baseline",
            category: Category::Dast,
            severity_floor: Severity::Low,
            summary: "The cheapest 30% of web hardening you'll ever do.",
            steps: &[
                "Content-Security-Policy with a script-src allowlist (no `unsafe-inline`).",
                "Strict-Transport-Security: max-age=63072000; includeSubDomains; preload",
                "X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin.",
                "Set SameSite=Lax (or Strict) and Secure on every session cookie.",
            ],
            applies_to: &["nuclei:http-misconfig", "headers"],
            references: &[
                "https://owasp.org/www-project-secure-headers/",
            ],
        },
        Tip {
            id: "network.attack-surface",
            title: "Minimize externally-reachable services",
            category: Category::Network,
            severity_floor: Severity::Medium,
            summary: "Every open port is a maintenance cost. The best port is a closed port.",
            steps: &[
                "Audit nmap output: for each listening port, ask 'should the internet reach this?'",
                "Bind admin services (databases, dashboards) to a private interface, expose via VPN/SSM/Tailscale.",
                "Disable legacy plaintext protocols entirely (telnet, ftp, smbv1).",
                "Front-line SSH should require keys + fail2ban + a non-default port (defense in depth, not security).",
            ],
            applies_to: &["nmap:open"],
            references: &[
                "https://www.cisa.gov/news-events/news/avoiding-pitfalls-securing-internet-facing-systems",
            ],
        },
        Tip {
            id: "host.cis-baseline",
            title: "Apply a CIS Benchmark baseline to every host",
            category: Category::HostHardening,
            severity_floor: Severity::Low,
            summary: "Don't reinvent hardening — Lynis + a CIS profile catches the obvious gaps.",
            steps: &[
                "Run `lynis audit system` on a freshly built image; treat the hardening index as a build gate.",
                "Disable unused kernel modules and remove unused packages from your base image.",
                "Enable auditd / osquery and ship logs off-host.",
                "Patch automatically: unattended-upgrades on Debian, dnf-automatic on RHEL.",
            ],
            applies_to: &["lynis"],
            references: &[
                "https://www.cisecurity.org/cis-benchmarks",
            ],
        },
        Tip {
            id: "workflow.shift-left",
            title: "Wire scans into CI, not just into curiosity",
            category: Category::Sast,
            severity_floor: Severity::Info,
            summary: "A scanner that runs once a quarter is a scanner that runs never.",
            steps: &[
                "Add gitleaks + semgrep + trivy as required GitHub Actions checks on every PR.",
                "Use a baseline file: existing findings don't block merge; new findings do.",
                "Fail the job only on severity >= High to avoid alert fatigue.",
                "Re-run weekly against main to catch newly-disclosed CVEs in pinned deps.",
            ],
            applies_to: &["workflow"],
            references: &[
                "https://owasp.org/www-project-devsecops-guideline/",
            ],
        },
    ]
});

pub fn for_finding(scanner: &str, rule_id: &str, cwes: &[String]) -> Vec<&'static Tip> {
    TIPS.iter()
        .filter(|t| {
            t.applies_to.iter().any(|tag| {
                let tag = *tag;
                if tag.starts_with("cwe:") {
                    let n = tag.trim_start_matches("cwe:");
                    cwes.iter().any(|c| c.contains(n))
                } else if let Some(rest) = tag.strip_prefix(&format!("{scanner}:")) {
                    rule_id.contains(rest)
                } else {
                    tag == scanner
                }
            })
        })
        .collect()
}
