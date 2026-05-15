//! Exports an `AuditRun` to JSON, SARIF 2.1.0, Markdown, or HTML.

use audit_core::{Finding, Severity};
use audit_orchestrator::AuditRun;
use serde_json::json;

pub fn to_json(run: &AuditRun) -> anyhow::Result<String> {
    Ok(serde_json::to_string_pretty(run)?)
}

pub fn to_sarif(run: &AuditRun) -> anyhow::Result<String> {
    // Group findings by scanner -> one SARIF run per tool.
    let mut by_tool: std::collections::BTreeMap<&str, Vec<&Finding>> = Default::default();
    for f in &run.findings {
        by_tool.entry(f.scanner.as_str()).or_default().push(f);
    }
    let runs: Vec<_> = by_tool
        .into_iter()
        .map(|(tool, findings)| {
            let rules: Vec<_> = findings
                .iter()
                .map(|f| json!({ "id": f.id, "shortDescription": { "text": f.title } }))
                .collect();
            let results: Vec<_> = findings
                .iter()
                .map(|f| {
                    json!({
                        "ruleId": f.id,
                        "level": match f.severity {
                            Severity::Critical | Severity::High => "error",
                            Severity::Medium => "warning",
                            _ => "note",
                        },
                        "message": { "text": f.title },
                        "locations": [{
                            "physicalLocation": {
                                "artifactLocation": { "uri": f.location.path.as_ref().map(|p| p.to_string_lossy().to_string()).unwrap_or_default() },
                                "region": { "startLine": f.location.start_line.unwrap_or(1) }
                            }
                        }],
                        "fingerprints": { "primary": f.fingerprint }
                    })
                })
                .collect();
            json!({
                "tool": { "driver": { "name": tool, "rules": rules } },
                "results": results
            })
        })
        .collect();

    Ok(serde_json::to_string_pretty(&json!({
        "version": "2.1.0",
        "$schema": "https://json.schemastore.org/sarif-2.1.0.json",
        "runs": runs
    }))?)
}

pub fn to_markdown(run: &AuditRun) -> String {
    let mut out = String::new();
    out.push_str(&format!("# Audit Report — {}\n\n", run.target_label));
    out.push_str(&format!("Run id: `{}`\n\n", run.id));

    let mut counts = [0usize; 5];
    for f in &run.findings {
        let idx = match f.severity {
            Severity::Critical => 0, Severity::High => 1, Severity::Medium => 2, Severity::Low => 3, Severity::Info => 4,
        };
        counts[idx] += 1;
    }
    out.push_str(&format!("**Summary:** {} critical / {} high / {} medium / {} low / {} info\n\n",
        counts[0], counts[1], counts[2], counts[3], counts[4]));

    for f in &run.findings {
        out.push_str(&format!("## [{:?}] {} \n_{}_\n\n", f.severity, f.title, f.scanner));
        if let Some(p) = &f.location.path {
            out.push_str(&format!("- File: `{}`", p.display()));
            if let Some(l) = f.location.start_line {
                out.push_str(&format!(":{l}"));
            }
            out.push('\n');
        }
        if !f.description.is_empty() {
            out.push_str(&format!("\n{}\n", f.description));
        }
        if let Some(fix) = &f.fix_suggestion {
            out.push_str(&format!("\n**Fix:** {fix}\n"));
        }
        out.push('\n');
    }
    out
}

pub fn to_html(run: &AuditRun) -> String {
    let body = to_markdown(run)
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;");
    format!(
        r#"<!doctype html><html><head><meta charset="utf-8"><title>Audit — {label}</title>
<style>
body{{font-family:ui-sans-serif,system-ui;max-width:960px;margin:2rem auto;padding:1rem;background:#0b0d12;color:#e7eaf3}}
h1,h2{{color:#a5b4fc}}
code,pre{{background:#161a23;padding:.15rem .4rem;border-radius:.3rem}}
</style></head><body><pre>{body}</pre></body></html>"#,
        label = html_escape(&run.target_label)
    )
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;")
}
