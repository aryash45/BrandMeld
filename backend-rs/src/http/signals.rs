use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post},
};
use uuid::Uuid;

use crate::{
    domain::signal::{CreateSignalRequest, Signal, SignalKind, SignalSource},
    state::AppState,
};

pub fn signal_routes() -> Router<AppState> {
    Router::new()
        .route("/v2/signals", post(create_signal))
        .route("/v2/signals/{id}", get(get_signal))
        .route("/v2/signals/mock-github-release", post(mock_github_release))
}

async fn create_signal(
    State(state): State<AppState>,
    Json(request): Json<CreateSignalRequest>,
) -> (StatusCode, Json<Signal>) {
    let signal = request.into_signal();
    state
        .signals
        .write()
        .await
        .insert(signal.id, signal.clone());

    (StatusCode::CREATED, Json(signal))
}

async fn mock_github_release(State(state): State<AppState>) -> (StatusCode, Json<Signal>) {
    create_signal(
        State(state),
        Json(CreateSignalRequest {
            source: SignalSource::GithubRelease,
            kind: SignalKind::NewRelease,
            title: "Payments API v2.3.0 released".to_owned(),
            body: "Authentication now requires scoped tokens. Existing API keys will stop working after 30 days.".to_owned(),
            repository: Some("brandmeld/example-payments-api".to_owned()),
            version: Some("v2.3.0".to_owned()),
        }),
    )
    .await
}

async fn get_signal(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Signal>, StatusCode> {
    state
        .signals
        .read()
        .await
        .get(&id)
        .cloned()
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}
