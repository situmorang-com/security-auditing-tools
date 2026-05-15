//! HTTP/SSE backend for the Sentinel web UI.
//!
//! Mirrors the Tauri command surface. Binds to 127.0.0.1 by default so the
//! scanner pipeline (which can read arbitrary directories and SSH to hosts) is
//! not reachable from the network. Use `--bind 0.0.0.0` only if you know what
//! you're doing — and add an auth proxy in front.

use audit_core::{ScanEvent, Target};
use audit_orchestrator::{AuditRun, Orchestrator};
use audit_reporter as reporter;
use audit_tips::TIPS;
use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{sse::Event, IntoResponse, Sse},
    routing::{get, post},
    Json, Router,
};
use clap::Parser;
use serde::Deserialize;
use std::{convert::Infallible, net::SocketAddr, path::PathBuf, sync::Arc};
use tokio::sync::{broadcast, Mutex};
use tokio_stream::{wrappers::BroadcastStream, StreamExt};
use tower_http::{services::{ServeDir, ServeFile}, trace::TraceLayer};

#[derive(Parser, Debug, Clone)]
#[command(name = "audit-server", version, about = "Sentinel web backend")]
struct Args {
    /// Address to bind. 127.0.0.1 is strongly recommended unless you've
    /// thought carefully about who can reach this port.
    #[arg(long, env = "SENTINEL_BIND", default_value = "127.0.0.1:7777")]
    bind: String,
    /// Path to the built React bundle (dist/). If omitted, serves API only.
    #[arg(long, env = "SENTINEL_STATIC_DIR")]
    static_dir: Option<PathBuf>,
    /// Run mode. `full` exposes scanners; `showcase` disables the audit
    /// endpoints and only serves the Tips + Maturity content. For public
    /// deployments use `showcase`.
    #[arg(long, env = "SENTINEL_MODE", default_value = "full")]
    mode: ServerMode,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, clap::ValueEnum, serde::Serialize)]
#[serde(rename_all = "lowercase")]
enum ServerMode {
    Full,
    Showcase,
}

#[derive(Clone)]
struct AppState {
    orchestrator: Arc<Orchestrator>,
    events_tx: broadcast::Sender<ScanEvent>,
    completion_tx: broadcast::Sender<AuditRun>,
    last_run: Arc<Mutex<Option<AuditRun>>>,
    mode: ServerMode,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info,tower_http=warn".into()))
        .init();
    let args = Args::parse();

    let (events_tx, _) = broadcast::channel::<ScanEvent>(2048);
    let (completion_tx, _) = broadcast::channel::<AuditRun>(16);

    let state = AppState {
        orchestrator: Arc::new(Orchestrator::default()),
        events_tx,
        completion_tx,
        last_run: Arc::new(Mutex::new(None)),
        mode: args.mode,
    };

    tracing::info!("running in {:?} mode", args.mode);

    let api = Router::new()
        .route("/health", get(health))
        .route("/mode", get(get_mode))
        .route("/preflight", get(preflight))
        .route("/audit", post(run_audit))
        .route("/tips", get(list_tips))
        .route("/report", get(export_report))
        .route("/events", get(sse_events))
        .with_state(state);

    let mut app = Router::new().nest("/api", api).layer(TraceLayer::new_for_http());

    if let Some(dir) = args.static_dir.as_ref() {
        // SPA: fall back to index.html for client-side routes.
        let index = dir.join("index.html");
        app = app.fallback_service(ServeDir::new(dir).fallback(ServeFile::new(index)));
        tracing::info!("serving static UI from {}", dir.display());
    } else {
        app = app.route("/", get(|| async { "audit-server: API only mode (no --static-dir). See /api/*" }));
    }

    let addr: SocketAddr = args.bind.parse()?;
    if !addr.ip().is_loopback() {
        tracing::warn!(
            "binding to a non-loopback address ({}). Anyone who can reach this port can scan arbitrary paths and SSH targets. Make sure you have auth in front.",
            addr
        );
    }
    tracing::info!("listening on http://{addr}");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

// ---- handlers ----

async fn health() -> impl IntoResponse {
    (StatusCode::OK, "ok")
}

async fn get_mode(State(s): State<AppState>) -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "mode": s.mode,
        "scanning_enabled": matches!(s.mode, ServerMode::Full),
    }))
}

fn forbid_in_showcase(mode: ServerMode) -> Result<(), (StatusCode, String)> {
    if matches!(mode, ServerMode::Showcase) {
        return Err((
            StatusCode::FORBIDDEN,
            "this Sentinel instance is in showcase mode — install the desktop app to run scans".into(),
        ));
    }
    Ok(())
}

async fn preflight(State(s): State<AppState>) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    forbid_in_showcase(s.mode)?;
    let items: Vec<_> = s
        .orchestrator
        .preflight()
        .into_iter()
        .map(|(info, install)| serde_json::json!({ "info": info, "install": install }))
        .collect();
    Ok(Json(serde_json::Value::Array(items)))
}

async fn list_tips() -> Json<Vec<&'static audit_tips::Tip>> {
    Json(TIPS.iter().collect())
}

#[derive(Deserialize)]
struct AuditReq {
    target: Target,
}

async fn run_audit(State(s): State<AppState>, Json(req): Json<AuditReq>) -> Result<Json<AuditRun>, (StatusCode, String)> {
    forbid_in_showcase(s.mode)?;
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<ScanEvent>();
    let events_tx = s.events_tx.clone();
    let pump = tokio::spawn(async move {
        while let Some(ev) = rx.recv().await {
            let _ = events_tx.send(ev);
        }
    });
    let run = s.orchestrator.run(req.target, tx).await;
    let _ = pump.await;
    *s.last_run.lock().await = Some(run.clone());
    let _ = s.completion_tx.send(run.clone());
    Ok(Json(run))
}

#[derive(Deserialize)]
struct ReportQuery {
    format: String,
}

async fn export_report(State(s): State<AppState>, Query(q): Query<ReportQuery>) -> impl IntoResponse {
    if matches!(s.mode, ServerMode::Showcase) {
        return (StatusCode::FORBIDDEN, "scanning disabled in showcase mode".to_string()).into_response();
    }
    let last = s.last_run.lock().await;
    let Some(run) = last.as_ref() else {
        return (StatusCode::BAD_REQUEST, "no audit run available — start a scan first".to_string()).into_response();
    };
    let result = match q.format.as_str() {
        "json"              => reporter::to_json(run).map_err(|e| e.to_string()),
        "sarif"             => reporter::to_sarif(run).map_err(|e| e.to_string()),
        "markdown" | "md"   => Ok(reporter::to_markdown(run)),
        "html"              => Ok(reporter::to_html(run)),
        other               => Err(format!("unknown format: {other}")),
    };
    match result {
        Ok(body) => body.into_response(),
        Err(e) => (StatusCode::BAD_REQUEST, e).into_response(),
    }
}

async fn sse_events(State(s): State<AppState>) -> Sse<impl futures::Stream<Item = Result<Event, Infallible>>> {
    // The SSE event *name* discriminates (`scan-event` vs `scan-complete`); the
    // data is the raw payload JSON, matching the Tauri-side event shape so the
    // frontend can use one parser.
    let events = BroadcastStream::new(s.events_tx.subscribe())
        .filter_map(|r| r.ok())
        .map(|ev| {
            let data = serde_json::to_string(&ev).unwrap_or_default();
            Ok::<_, Infallible>(Event::default().event("scan-event").data(data))
        });
    let completes = BroadcastStream::new(s.completion_tx.subscribe())
        .filter_map(|r| r.ok())
        .map(|run| {
            let data = serde_json::to_string(&run).unwrap_or_default();
            Ok::<_, Infallible>(Event::default().event("scan-complete").data(data))
        });
    let merged = events.merge(completes);
    Sse::new(merged).keep_alive(axum::response::sse::KeepAlive::default())
}
