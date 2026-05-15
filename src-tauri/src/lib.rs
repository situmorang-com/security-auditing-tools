use audit_core::{InstallStatus, ScanEvent, ScannerInfo, Target};
use audit_orchestrator::{AuditRun, Orchestrator};
use audit_reporter as reporter;
use audit_tips::{Tip, TIPS};
use serde::Serialize;
use std::sync::Arc;
use tauri::{Emitter, Manager, State};
use tokio::sync::{mpsc, Mutex};

struct AppState {
    orchestrator: Arc<Orchestrator>,
    last_run: Mutex<Option<AuditRun>>,
}

#[derive(Serialize)]
struct PreflightItem {
    info: ScannerInfo,
    install: InstallStatus,
}

#[tauri::command]
async fn list_tips() -> Vec<&'static Tip> {
    TIPS.iter().collect()
}

#[tauri::command]
async fn preflight(state: State<'_, AppState>) -> Result<Vec<PreflightItem>, String> {
    Ok(state
        .orchestrator
        .preflight()
        .into_iter()
        .map(|(info, install)| PreflightItem { info, install })
        .collect())
}

#[tauri::command]
async fn run_audit(
    target: Target,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<AuditRun, String> {
    let (tx, mut rx) = mpsc::unbounded_channel::<ScanEvent>();
    let orch = Arc::clone(&state.orchestrator);

    // Spawn the event pump so the UI sees live events.
    let app_for_events = app.clone();
    let pump = tokio::spawn(async move {
        while let Some(ev) = rx.recv().await {
            let _ = app_for_events.emit("scan-event", &ev);
        }
    });

    let run = orch.run(target, tx).await;
    let _ = pump.await;

    *state.last_run.lock().await = Some(run.clone());
    let _ = app.emit("scan-complete", &run);
    Ok(run)
}

#[tauri::command]
async fn export_report(
    format: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let last = state.last_run.lock().await;
    let Some(run) = last.as_ref() else {
        return Err("no audit run available — start a scan first".into());
    };
    match format.as_str() {
        "json" => reporter::to_json(run).map_err(|e| e.to_string()),
        "sarif" => reporter::to_sarif(run).map_err(|e| e.to_string()),
        "markdown" | "md" => Ok(reporter::to_markdown(run)),
        "html" => Ok(reporter::to_html(run)),
        other => Err(format!("unknown format: {other}")),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .try_init()
        .ok();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            app.manage(AppState {
                orchestrator: Arc::new(Orchestrator::default()),
                last_run: Mutex::new(None),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            preflight,
            run_audit,
            list_tips,
            export_report
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
