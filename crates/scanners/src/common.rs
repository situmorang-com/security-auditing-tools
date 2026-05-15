use audit_core::InstallStatus;
use std::path::PathBuf;
use tokio::process::Command;

/// Look up a binary on PATH and try `<bin> --version`.
pub fn detect(scanner_id: &str, binary: &str, version_args: &[&str]) -> InstallStatus {
    let path: Option<PathBuf> = which::which(binary).ok();
    let installed = path.is_some();
    let version = path.as_ref().and_then(|_| {
        std::process::Command::new(binary)
            .args(version_args)
            .output()
            .ok()
            .and_then(|out| {
                let s = String::from_utf8_lossy(&out.stdout).to_string();
                let s = if s.trim().is_empty() {
                    String::from_utf8_lossy(&out.stderr).to_string()
                } else {
                    s
                };
                s.lines().next().map(|l| l.trim().to_string())
            })
    });
    InstallStatus {
        scanner_id: scanner_id.to_string(),
        installed,
        version,
        binary_path: path,
    }
}

/// Run a tool, return stdout. Tools that exit non-zero when findings are
/// present (e.g. gitleaks, semgrep) are normal — we treat any output as
/// authoritative regardless of exit code.
pub async fn run_capture(bin: &str, args: &[&str], cwd: Option<&std::path::Path>) -> anyhow::Result<String> {
    let mut cmd = Command::new(bin);
    cmd.args(args);
    if let Some(d) = cwd {
        cmd.current_dir(d);
    }
    let output = cmd.output().await?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}
