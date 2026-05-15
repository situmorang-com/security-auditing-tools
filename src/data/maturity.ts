/**
 * Three industry-standard maturity frameworks, side-by-side.
 *
 *   - NIST CSF 2.0 — broad cybersecurity program coverage (org + tech)
 *   - CIS Controls v8.1 (IG1) — the "essential cyber hygiene" checklist
 *   - OWASP SAMM 2.0 — software-development-specific maturity
 *
 * All three are scored on a unified per-practice button strip. The number of
 * buttons and what they mean is framework-specific (e.g. SAMM is natively 0–3,
 * CSF is 0–4) — driven by `levelLabels` per framework. Overall maturity tier
 * is computed by averaging practice scores and bucketing via `tiers`.
 */

export interface Practice {
  id: string;          // framework-native id (e.g. "GV.OC-01", "1.1", "TA1")
  title: string;
  rationale: string;
  examples: string[];
}

export interface Category {
  id: string;
  title: string;
  practices: Practice[];
}

export interface Func {
  id: string;
  name: string;
  tagline: string;
  accent: string;
  categories: Category[];
}

export interface FrameworkAbout {
  what: string;        // one-paragraph definition
  whoFor: string;      // intended audience
  howToScore: string;  // how to interpret the scoring scale
  whenToUse: string;   // when to pick this over the others — the differentiator
  reference: string;   // official URL
  publisher: string;
}

export interface Tier {
  /** Inclusive lower bound on average score (0..maxLevel). */
  threshold: number;
  label: string;
}

export interface Framework {
  id: "nist-csf-2" | "cis-v8-ig1" | "samm-2";
  name: string;       // long name shown in the about panel
  shortName: string;  // tab label
  badge: string;      // small descriptor like "Broad", "Hygiene", "SDLC"
  about: FrameworkAbout;
  /** Buttons shown per practice. Index = score. Length defines max score+1. */
  levelLabels: string[];
  tiers: Tier[];
  functions: Func[];
}

export function tierFromAvg(avg: number, fw: Framework): { idx: number; label: string } {
  let chosen = { idx: 0, label: fw.tiers[0]?.label ?? "Not started" };
  fw.tiers.forEach((t, i) => {
    if (avg >= t.threshold) chosen = { idx: i, label: t.label };
  });
  return chosen;
}

export function maxScore(fw: Framework): number {
  return fw.levelLabels.length - 1;
}

export function allPracticeIds(fw: Framework): string[] {
  return fw.functions.flatMap((f) => f.categories.flatMap((c) => c.practices.map((p) => p.id)));
}

/* =====================================================================
 * NIST Cybersecurity Framework 2.0
 * ===================================================================== */

const NIST_CSF_2: Framework = {
  id: "nist-csf-2",
  name: "NIST Cybersecurity Framework 2.0",
  shortName: "NIST CSF 2.0",
  badge: "Broad program",
  about: {
    publisher: "NIST (US Department of Commerce)",
    what:
      "A risk-based framework organizing all of cybersecurity into six Functions (Govern, Identify, Protect, Detect, Respond, Recover). Version 2.0 (Feb 2024) added Govern as a peer function and is the modern lingua franca for cyber programs of any size.",
    whoFor:
      "Anyone responsible for a cybersecurity program — from a solo developer scoring themselves quarterly, up to a CISO aligning the org. Sector-agnostic.",
    howToScore:
      "Per practice, 0–4 mapping to CSF tier semantics: 0 not done, 1 ad-hoc (Partial), 2 defined but inconsistent (Risk-Informed), 3 documented and practiced (Repeatable), 4 metric-driven and continuously improving (Adaptive). Your overall average lands in one of four Tiers.",
    whenToUse:
      "Pick this when you want one framework to describe your *entire* security posture, including governance and incident response — not just the engineering work. Best 'starting' framework.",
    reference: "https://www.nist.gov/cyberframework",
  },
  levelLabels: ["Not yet", "Partial", "Risk-informed", "Repeatable", "Adaptive"],
  tiers: [
    { threshold: 0,   label: "Not started" },
    { threshold: 0.5, label: "Tier 1 — Partial" },
    { threshold: 1.5, label: "Tier 2 — Risk Informed" },
    { threshold: 2.5, label: "Tier 3 — Repeatable" },
    { threshold: 3.5, label: "Tier 4 — Adaptive" },
  ],
  functions: [
    {
      id: "GV", name: "Govern", tagline: "Strategy, roles, policy, oversight, and supply-chain risk.", accent: "indigo",
      categories: [
        { id: "GV.OC", title: "Organizational Context", practices: [
          { id: "GV.OC-01", title: "Mission and stakeholders are documented",
            rationale: "You can't prioritize what to protect if you haven't named what matters or to whom.",
            examples: ["A one-page document lists what the product/team does and for whom.", "Key external dependencies (cloud, payment, identity) are identified."] },
          { id: "GV.OC-03", title: "Legal/regulatory cyber requirements are tracked",
            rationale: "GDPR, HIPAA, SOC 2, PCI-DSS, customer DPAs each create concrete obligations.",
            examples: ["A list of applicable regulations exists and is reviewed yearly.", "Customer contracts with security clauses are tagged."] },
        ]},
        { id: "GV.RM", title: "Risk Management Strategy", practices: [
          { id: "GV.RM-01", title: "Risk appetite and tolerance are defined",
            rationale: "Without thresholds you cannot decide whether a finding is shippable.",
            examples: ["No Critical/High open at release.", "RTO/RPO values declared for each tier-1 system."] },
        ]},
        { id: "GV.RR", title: "Roles, Responsibilities, Authorities", practices: [
          { id: "GV.RR-02", title: "A named owner is accountable for cybersecurity",
            rationale: "Diffuse ownership = no ownership. Even a solo dev should explicitly own this hat.",
            examples: ["Org chart names the security DRI.", "On-call rotation includes a 'security IC' role."] },
        ]},
        { id: "GV.PO", title: "Policy", practices: [
          { id: "GV.PO-01", title: "A current written security policy exists (<12 months old)",
            rationale: "Policy is the contract you'll hold yourself and others to.",
            examples: ["SECURITY.md describes acceptable use, secret handling, disclosure.", "Reviewed after every major incident."] },
        ]},
        { id: "GV.SC", title: "Supply Chain Risk", practices: [
          { id: "GV.SC-04", title: "Third-party / open-source dependencies are inventoried (SBOM)",
            rationale: "You can't patch a Log4Shell-class vuln in dependencies you can't enumerate.",
            examples: ["SBOM generated on every release (syft, cargo-cyclonedx, npm sbom).", "Critical vendors have annual risk review."] },
        ]},
      ],
    },
    {
      id: "ID", name: "Identify", tagline: "Inventory of assets, data, and risks.", accent: "sky",
      categories: [
        { id: "ID.AM", title: "Asset Management", practices: [
          { id: "ID.AM-01", title: "Hardware and endpoints are inventoried",
            rationale: "An asset you don't know about is one you can't defend or patch.",
            examples: ["MDM (Kandji/Jamf/Intune) or a current spreadsheet.", "Offboarding removes creds from devices."] },
          { id: "ID.AM-02", title: "Software, services, and APIs are inventoried",
            rationale: "Shadow IT is a top breach vector.",
            examples: ["SaaS list with owners + renewal dates.", "Service catalog enumerates internal APIs."] },
          { id: "ID.AM-05", title: "Assets are classified by sensitivity",
            rationale: "Classification drives proportional spend.",
            examples: ["Data tagged Public/Internal/Confidential/Restricted.", "Crown-jewel systems flagged (payment/auth/PII)."] },
        ]},
        { id: "ID.RA", title: "Risk Assessment", practices: [
          { id: "ID.RA-01", title: "Known vulnerabilities are identified",
            rationale: "Sentinel's scanners cover this — but only if you run them on a cadence.",
            examples: ["SAST/SCA on every PR in CI.", "Re-scan main weekly for newly-disclosed CVEs."] },
          { id: "ID.RA-04", title: "Threats and likelihoods are documented",
            rationale: "A short threat model beats no threat model.",
            examples: ["Lightweight STRIDE per feature added to design doc.", "Top-5 threat scenarios listed."] },
        ]},
        { id: "ID.IM", title: "Improvement", practices: [
          { id: "ID.IM-01", title: "Lessons learned are captured after incidents and tests",
            rationale: "An incident you didn't post-mortem will recur.",
            examples: ["Every incident has a blameless post-mortem.", "Action items tracked to completion."] },
        ]},
      ],
    },
    {
      id: "PR", name: "Protect", tagline: "Identity, training, data, platforms, resilience.", accent: "emerald",
      categories: [
        { id: "PR.AA", title: "Identity & Access Management", practices: [
          { id: "PR.AA-01", title: "Identities are uniquely assigned and managed",
            rationale: "Shared accounts erase the audit trail.",
            examples: ["SSO is the only way in.", "Service accounts have owners + rotation schedules."] },
          { id: "PR.AA-03", title: "MFA is enforced for all human accounts",
            rationale: "Phishing-resistant MFA defeats ~99% of credential attacks.",
            examples: ["Hardware keys/passkeys for admins.", "TOTP min for everyone else."] },
          { id: "PR.AA-05", title: "Least privilege is enforced and reviewed",
            rationale: "Privilege accretes; reviews are the only way to undo it.",
            examples: ["Quarterly access review for prod.", "Just-in-time elevation instead of standing admin."] },
        ]},
        { id: "PR.AT", title: "Awareness & Training", practices: [
          { id: "PR.AT-01", title: "Security awareness is delivered to everyone with system access",
            rationale: "Even a 1-person team should refresh — phishing campaigns evolve.",
            examples: ["Annual training on phishing/secrets/social engineering.", "Simulated phishing 2×/year."] },
        ]},
        { id: "PR.DS", title: "Data Security", practices: [
          { id: "PR.DS-01", title: "Data at rest is encrypted",
            rationale: "Disk encryption is a 'free' control — no reason not to.",
            examples: ["FileVault/BitLocker required on endpoints.", "DB storage encryption enabled (KMS)."] },
          { id: "PR.DS-02", title: "Data in transit is encrypted",
            rationale: "TLS everywhere; automate cert mgmt.",
            examples: ["HSTS + redirect-to-HTTPS on every public endpoint.", "Service-to-service mTLS or service mesh."] },
          { id: "PR.DS-11", title: "Backups are tested",
            rationale: "Untested backups are wishes. Ransomware doesn't care about wishes.",
            examples: ["Restore drill quarterly.", "Backups stored in a separate trust boundary."] },
        ]},
        { id: "PR.PS", title: "Platform Security", practices: [
          { id: "PR.PS-02", title: "Software is patched on a defined cadence",
            rationale: "Most exploited CVEs have had patches for months.",
            examples: ["Auto-update for OS/browsers.", "Critical patches within an SLA (e.g. 7 days)."] },
          { id: "PR.PS-06", title: "Secure SDLC practices are followed",
            rationale: "Security baked into design and CI beats audits at release.",
            examples: ["All merges to main require code review.", "SAST/SCA/secrets as required PR checks."] },
        ]},
        { id: "PR.IR", title: "Infrastructure Resilience", practices: [
          { id: "PR.IR-01", title: "Networks are segmented and protected",
            rationale: "Flat networks turn one breach into total breach.",
            examples: ["Prod isolated from dev/corp.", "Default-deny egress where possible."] },
        ]},
      ],
    },
    {
      id: "DE", name: "Detect", tagline: "Continuous monitoring and adverse-event analysis.", accent: "amber",
      categories: [
        { id: "DE.CM", title: "Continuous Monitoring", practices: [
          { id: "DE.CM-01", title: "Networks and systems are monitored for adverse events",
            rationale: "Without telemetry you'll learn about breaches from customers — on Twitter.",
            examples: ["Centralized logs (>= 90-day retention).", "Auth/admin/data-access events logged."] },
          { id: "DE.CM-09", title: "Endpoints have EDR / anti-malware",
            rationale: "Built-in OS protections are baseline; EDR adds investigative depth.",
            examples: ["Defender/CrowdStrike/SentinelOne deployed.", "Tamper protection enabled."] },
        ]},
        { id: "DE.AE", title: "Adverse Event Analysis", practices: [
          { id: "DE.AE-02", title: "Alerts are triaged with documented thresholds",
            rationale: "An alert nobody investigates doesn't exist.",
            examples: ["A runbook says who responds to what within how long.", "Alerts tuned to high precision."] },
        ]},
      ],
    },
    {
      id: "RS", name: "Respond", tagline: "Incident management, analysis, communication, mitigation.", accent: "orange",
      categories: [
        { id: "RS.MA", title: "Incident Management", practices: [
          { id: "RS.MA-01", title: "An incident response plan exists",
            rationale: "Write it down before you need it.",
            examples: ["IR plan documents severities, escalation, on-call.", "Tabletop exercise at least yearly."] },
          { id: "RS.MA-03", title: "Roles are clear during an incident (IC, comms, scribe)",
            rationale: "Diffused responsibility wastes the most expensive 30 minutes.",
            examples: ["Incident roles defined and rotated.", "First action of any incident: assign IC + scribe."] },
        ]},
        { id: "RS.CO", title: "Communication", practices: [
          { id: "RS.CO-02", title: "Notification obligations are known and rehearsed",
            rationale: "GDPR is 72 hours; many state laws are shorter.",
            examples: ["Customer/regulator notification templates pre-drafted.", "Legal + comms contacts in IR plan."] },
        ]},
        { id: "RS.MI", title: "Incident Mitigation", practices: [
          { id: "RS.MI-01", title: "Containment actions are pre-authorized",
            rationale: "If isolating a host requires a VP signoff, you've lost.",
            examples: ["On-call can revoke creds, isolate hosts, rotate keys.", "Break-glass procedures tested."] },
        ]},
      ],
    },
    {
      id: "RC", name: "Recover", tagline: "Restoration plans and post-incident communication.", accent: "rose",
      categories: [
        { id: "RC.RP", title: "Recovery Plan Execution", practices: [
          { id: "RC.RP-01", title: "Recovery procedures are documented and tested",
            rationale: "Tested recovery is the difference between outage and catastrophe.",
            examples: ["Restore-from-backup meets RTO in drills.", "Cross-region failover is exercised."] },
          { id: "RC.RP-05", title: "Integrity of restored assets is verified",
            rationale: "Restoring compromised data re-introduces the breach.",
            examples: ["Backups immutable (object lock/WORM).", "Hash-verify before declaring 'restored'."] },
        ]},
        { id: "RC.CO", title: "Recovery Communication", practices: [
          { id: "RC.CO-03", title: "Recovery status is communicated to stakeholders",
            rationale: "Silence amplifies trust loss. Slow + truthful beats fast + speculative.",
            examples: ["Public statuspage updated on cadence.", "Internal exec update template ready."] },
        ]},
      ],
    },
  ],
};

/* =====================================================================
 * CIS Controls v8.1 — Implementation Group 1 (IG1) subset
 * ===================================================================== */

const CIS_V8_IG1: Framework = {
  id: "cis-v8-ig1",
  name: "CIS Critical Security Controls v8.1 — Implementation Group 1",
  shortName: "CIS IG1 v8.1",
  badge: "Hygiene basics",
  about: {
    publisher: "Center for Internet Security",
    what:
      "A prioritized list of 18 Controls broken into Safeguards. Implementation Group 1 (IG1) is the 'essential cyber hygiene' subset — the 56 safeguards every organization should implement, regardless of size or industry.",
    whoFor:
      "Small/medium orgs (and solo devs) who want a concrete, action-oriented checklist instead of a risk framework. Sysadmin / SRE leaning.",
    howToScore:
      "Per safeguard, 0–4: 0 not done, 1 documented only, 2 implemented manually, 3 implemented and automated, 4 implemented + automated + reported. CIS calls IG1 binary-ish in practice — treat 3 as 'good' and 4 as 'measured'.",
    whenToUse:
      "Pick this when you want a tactical to-do list of what to actually configure and harden. Complements CSF: CSF tells you *what categories* to care about, CIS IG1 tells you *exactly which configs to flip*.",
    reference: "https://www.cisecurity.org/controls/cis-controls-list",
  },
  levelLabels: ["Not done", "Documented", "Implemented", "Automated", "Reported"],
  tiers: [
    { threshold: 0,   label: "Not started" },
    { threshold: 0.5, label: "Reactive — basic hygiene incomplete" },
    { threshold: 1.5, label: "Foundational — IG1 mostly in place" },
    { threshold: 2.5, label: "Standardized — IG1 implemented" },
    { threshold: 3.5, label: "Automated — IG1 monitored + measured" },
  ],
  functions: [
    {
      id: "C1-2", name: "Asset Inventory", tagline: "Know what you have (Controls 1 & 2).", accent: "indigo",
      categories: [
        { id: "CIS-1", title: "Control 1 — Enterprise Assets", practices: [
          { id: "1.1", title: "Maintain a detailed enterprise asset inventory",
            rationale: "Every laptop, server, VM, cloud instance — if it's not in the list, it can't be protected.",
            examples: ["MDM-driven device list, refreshed weekly.", "Cloud accounts inventoried via AWS Config / GCP Asset Inventory."] },
          { id: "1.2", title: "Address unauthorized assets",
            rationale: "An asset that appears unannounced is either an oversight or an intruder.",
            examples: ["Process to remove, quarantine, or approve unknown devices within 1 week.", "ARP/DHCP scans cross-checked vs inventory."] },
        ]},
        { id: "CIS-2", title: "Control 2 — Software Assets", practices: [
          { id: "2.1", title: "Maintain a software inventory",
            rationale: "You can't patch what you don't know is installed.",
            examples: ["SBOM per production service.", "OS package lists exportable from MDM/config mgmt."] },
          { id: "2.2", title: "Ensure software is supported (not end-of-life)",
            rationale: "EOL software stops getting security patches the day vendors stop shipping them.",
            examples: ["Annual review flags EOL OSes, runtimes, frameworks.", "Tickets opened for migrations >6 months before EOL."] },
          { id: "2.3", title: "Address unauthorized software",
            rationale: "Unmanaged installs are how malware and license violations enter.",
            examples: ["Allowlist enforced via MDM/AppLocker/Gatekeeper.", "Quarterly audit of installed apps."] },
        ]},
      ],
    },
    {
      id: "C3", name: "Data Protection", tagline: "Classify, retain, and dispose of data (Control 3).", accent: "sky",
      categories: [
        { id: "CIS-3", title: "Control 3 — Data Protection", practices: [
          { id: "3.1", title: "Maintain a data management process",
            rationale: "Decisions about retention, encryption, sharing all depend on classification.",
            examples: ["Written data classification scheme.", "Each system has a documented data owner."] },
          { id: "3.4", title: "Enforce data retention",
            rationale: "Data you keep past its purpose is liability without value.",
            examples: ["Retention rules in S3/GCS lifecycle policies.", "DB tables tagged with retention windows."] },
          { id: "3.5", title: "Securely dispose of data",
            rationale: "Deleted ≠ unrecoverable. Disposal procedures matter on offboarding and EOL.",
            examples: ["Wipe procedure for laptops at offboard.", "Certificates-of-destruction kept for media."] },
        ]},
      ],
    },
    {
      id: "C4", name: "Secure Configuration", tagline: "Harden defaults (Control 4).", accent: "emerald",
      categories: [
        { id: "CIS-4", title: "Control 4 — Secure Configuration", practices: [
          { id: "4.1", title: "Maintain a secure configuration process",
            rationale: "Defaults are designed for setup ease, not for production safety.",
            examples: ["Hardened base AMIs / golden images.", "CIS Benchmarks applied via Ansible/Chef/Salt."] },
          { id: "4.7", title: "Manage default accounts on assets and software",
            rationale: "Default admin creds are the #1 cause of mass internet exposure.",
            examples: ["Disable/rename root, admin, guest on every new system.", "Verify default cloud-provider IAM roles are scoped."] },
        ]},
      ],
    },
    {
      id: "C5-6", name: "Account & Access", tagline: "Inventory accounts and enforce MFA (Controls 5 & 6).", accent: "amber",
      categories: [
        { id: "CIS-5", title: "Control 5 — Account Management", practices: [
          { id: "5.1", title: "Maintain an inventory of accounts",
            rationale: "Orphaned accounts are persistent backdoors.",
            examples: ["SSO is system of record; orphan-account reports run quarterly.", "Service-account owners reviewed yearly."] },
          { id: "5.3", title: "Disable dormant accounts",
            rationale: "An account unused for 45 days is more useful to an attacker than to its owner.",
            examples: ["Auto-disable after 45 days inactivity.", "Offboarding script revokes on day 1."] },
        ]},
        { id: "CIS-6", title: "Control 6 — Access Control Management", practices: [
          { id: "6.3", title: "Require MFA for externally-exposed applications",
            rationale: "Anything reachable from the internet must require MFA. No exceptions.",
            examples: ["SSO + WebAuthn for VPN, email, admin panels.", "App-level MFA where SSO isn't possible."] },
          { id: "6.5", title: "Require MFA for administrative access",
            rationale: "Privileged accounts deserve phishing-resistant MFA, not SMS.",
            examples: ["Hardware keys (YubiKey) required for cloud admin.", "Break-glass account stored offline."] },
        ]},
      ],
    },
    {
      id: "C7", name: "Vulnerability Management", tagline: "Find and fix CVEs (Control 7).", accent: "orange",
      categories: [
        { id: "CIS-7", title: "Control 7 — Continuous Vulnerability Management", practices: [
          { id: "7.1", title: "Maintain a vulnerability management process",
            rationale: "Without a defined process, vuln triage becomes panic per incident.",
            examples: ["Written SLA: criticals patched in 7d, highs in 30d.", "Owner per repo/service for vuln triage."] },
          { id: "7.3", title: "Automated OS patch management",
            rationale: "Manual patching at scale loses to attackers every time.",
            examples: ["unattended-upgrades / dnf-automatic on Linux.", "WSUS or Intune Update Rings on Windows."] },
        ]},
      ],
    },
    {
      id: "C8", name: "Audit Logging", tagline: "Collect logs you can investigate with (Control 8).", accent: "rose",
      categories: [
        { id: "CIS-8", title: "Control 8 — Audit Log Management", practices: [
          { id: "8.1", title: "Maintain an audit log management process",
            rationale: "What to log, where to send it, how long to keep it — decided once, not per incident.",
            examples: ["Log retention policy (>= 90 days hot, 1 year cold).", "Time sync via NTP on every host."] },
          { id: "8.2", title: "Collect audit logs",
            rationale: "If it's not collected, it can't be investigated.",
            examples: ["Auth, admin, network, app logs forwarded to central store.", "Cloud audit logs (CloudTrail, GCP Audit) enabled in every account."] },
        ]},
      ],
    },
    {
      id: "C14", name: "Training", tagline: "Make people part of the defense (Control 14).", accent: "sky",
      categories: [
        { id: "CIS-14", title: "Control 14 — Security Awareness Training", practices: [
          { id: "14.1", title: "Maintain a security awareness program",
            rationale: "Most breaches still start with a person being tricked.",
            examples: ["Annual training covering phishing, secrets, MFA.", "New-hire onboarding includes a security module."] },
        ]},
      ],
    },
    {
      id: "C17", name: "Incident Response", tagline: "Be ready before you need it (Control 17).", accent: "indigo",
      categories: [
        { id: "CIS-17", title: "Control 17 — Incident Response Management", practices: [
          { id: "17.1", title: "Designate personnel to manage incident handling",
            rationale: "An incident with no commander runs in every direction at once.",
            examples: ["Primary + backup IC named in the IR plan.", "Out-of-band contact methods documented."] },
          { id: "17.3", title: "Establish a process for reporting incidents",
            rationale: "Employees need a clear, low-friction way to escalate suspicious activity.",
            examples: ["Single email/Slack channel for security reports.", "Anonymous reporting option."] },
        ]},
      ],
    },
  ],
};

/* =====================================================================
 * OWASP SAMM 2.0 — Software Assurance Maturity Model
 * ===================================================================== */

const SAMM_2: Framework = {
  id: "samm-2",
  name: "OWASP Software Assurance Maturity Model 2.0",
  shortName: "OWASP SAMM 2.0",
  badge: "Software-specific",
  about: {
    publisher: "OWASP Foundation",
    what:
      "A maturity model specifically for software development organizations. SAMM 2.0 covers 5 Business Functions × 3 Security Practices = 15 practices, each with 3 maturity levels describing concrete activities and metrics.",
    whoFor:
      "Engineering teams and AppSec leads building / shipping software. Use this when 'security' for you mostly means 'how secure is the code we write and ship'.",
    howToScore:
      "Per practice, 0–3: 0 not in place, 1 initial activities (defined for some apps), 2 defined and consistent across the org, 3 optimized — measured, automated, continuously improved.",
    whenToUse:
      "Pick this when CSF feels too org/IT-focused and you need the model to actually grade your SDLC: threat modeling, secure builds, defect management, security testing, deploy hygiene. Most popular maturity model among AppSec practitioners.",
    reference: "https://owaspsamm.org/model/",
  },
  levelLabels: ["Not in place", "Initial", "Defined", "Optimized"],
  tiers: [
    { threshold: 0,    label: "Not started" },
    { threshold: 0.5,  label: "Maturity 1 — Initial" },
    { threshold: 1.5,  label: "Maturity 2 — Defined" },
    { threshold: 2.5,  label: "Maturity 3 — Optimized" },
  ],
  functions: [
    {
      id: "G", name: "Governance", tagline: "Strategy, policy, education.", accent: "indigo",
      categories: [
        { id: "G.SM", title: "Strategy & Metrics", practices: [
          { id: "SM1", title: "An application security roadmap exists with measurable goals",
            rationale: "Without metrics, AppSec is theater. SAMM emphasizes evidence over intent.",
            examples: ["Roadmap of SDLC improvements with quarterly checkpoints.", "AppSec KPIs (mean time to patch, %coverage)."] },
        ]},
        { id: "G.PC", title: "Policy & Compliance", practices: [
          { id: "PC1", title: "Application-relevant policies and compliance requirements are tracked",
            rationale: "Engineering needs policies expressed in code/CI terms, not legal prose.",
            examples: ["Coding standard documented and enforced via linter.", "Compliance mapped to CI gates (e.g. SOC 2 controls = SAST + access reviews)."] },
        ]},
        { id: "G.EG", title: "Education & Guidance", practices: [
          { id: "EG1", title: "Developers receive role-specific secure-development training",
            rationale: "Generic 'security awareness' doesn't change how a developer writes a JWT validator.",
            examples: ["Annual secure-coding lab in your stack.", "Onboarding includes the team's threat model."] },
        ]},
      ],
    },
    {
      id: "D", name: "Design", tagline: "Threat assessment, requirements, architecture.", accent: "sky",
      categories: [
        { id: "D.TA", title: "Threat Assessment", practices: [
          { id: "TA1", title: "Threat modeling is performed on high-risk features",
            rationale: "Many vulns are designed in. A 1-hour threat model is cheaper than a 1-month CVE.",
            examples: ["STRIDE / attack tree included in design docs for tier-1 features.", "AppSec reviewer signs off before implementation."] },
        ]},
        { id: "D.SR", title: "Security Requirements", practices: [
          { id: "SR1", title: "Security requirements are explicit and testable",
            rationale: "Implicit security is invisible to QA and CI alike.",
            examples: ["Acceptance criteria include negative tests.", "OWASP ASVS L1/L2 checklist applied per feature."] },
        ]},
        { id: "D.SA", title: "Security Architecture", practices: [
          { id: "SA1", title: "Reusable secure design patterns are maintained",
            rationale: "Don't make every team reinvent authn/authz/crypto — that's how vulns proliferate.",
            examples: ["Shared auth library / SDK.", "Documented 'secure-by-default' service template."] },
        ]},
      ],
    },
    {
      id: "I", name: "Implementation", tagline: "Build, deploy, manage defects.", accent: "emerald",
      categories: [
        { id: "I.SB", title: "Secure Build", practices: [
          { id: "SB1", title: "Builds are reproducible, integrity-verified, and dependency-tracked",
            rationale: "Most supply-chain attacks target the build, not the source.",
            examples: ["Reproducible builds with locked toolchains.", "SBOM generated and signed (Sigstore/cosign)."] },
        ]},
        { id: "I.SD", title: "Secure Deployment", practices: [
          { id: "SD1", title: "Deployment is automated, secrets are managed centrally",
            rationale: "Manual deploys are the leading source of misconfig-driven breaches.",
            examples: ["CI/CD pipelines as code; manual prod deploys disabled.", "Secrets from a vault, never in env files or repos."] },
        ]},
        { id: "I.DM", title: "Defect Management", practices: [
          { id: "DM1", title: "Security defects are tracked, prioritized, and trended",
            rationale: "Findings without an owner stay forever; trend metrics drive investment cases.",
            examples: ["Security bugs in the same tracker as functional bugs.", "Weekly dashboard of open critical/high vulns."] },
        ]},
      ],
    },
    {
      id: "V", name: "Verification", tagline: "Test the design and the code.", accent: "amber",
      categories: [
        { id: "V.AA", title: "Architecture Assessment", practices: [
          { id: "AA1", title: "Architecture is reviewed against security requirements",
            rationale: "Catches design-level errors that code review can't.",
            examples: ["Periodic architecture review board with AppSec.", "Boundary diagrams updated when systems change."] },
        ]},
        { id: "V.RT", title: "Requirements-Driven Testing", practices: [
          { id: "RT1", title: "Negative/abuse tests are automated for each security requirement",
            rationale: "Positive tests prove features work. Negative tests prove they can't be bypassed.",
            examples: ["Authz tests per role, per endpoint.", "Fuzz tests on every parser at the trust boundary."] },
        ]},
        { id: "V.ST", title: "Security Testing", practices: [
          { id: "ST1", title: "Automated SAST/DAST/SCA in CI; manual deep-dives for critical features",
            rationale: "Automation handles breadth; humans handle depth.",
            examples: ["Semgrep + Trivy + Gitleaks gating PRs (use Sentinel!).", "Annual external pen-test on tier-1 services."] },
        ]},
      ],
    },
    {
      id: "O", name: "Operations", tagline: "Run software securely in production.", accent: "rose",
      categories: [
        { id: "O.IM", title: "Incident Management", practices: [
          { id: "IM1", title: "Security incident process is exercised regularly",
            rationale: "Paper plans rot. Tabletops keep them fresh.",
            examples: ["Quarterly tabletop with engineering on-call.", "Post-incident reviews feed roadmap items."] },
        ]},
        { id: "O.EM", title: "Environment Management", practices: [
          { id: "EM1", title: "Runtime environments are hardened and patched",
            rationale: "The same vuln in the same OS package in 50 containers = 50 incidents.",
            examples: ["Base images patched within an SLA.", "Runtime security tools (Falco / runtime EDR)."] },
        ]},
        { id: "O.OM", title: "Operational Management", practices: [
          { id: "OM1", title: "Production data and access are governed",
            rationale: "PII in dev environments is one slack DM away from a breach.",
            examples: ["No prod data in non-prod environments without anonymization.", "Just-in-time prod access; all reads logged."] },
        ]},
      ],
    },
  ],
};

export const FRAMEWORKS: Framework[] = [NIST_CSF_2, CIS_V8_IG1, SAMM_2];

export function getFramework(id: Framework["id"]): Framework {
  return FRAMEWORKS.find((f) => f.id === id) ?? FRAMEWORKS[0];
}
