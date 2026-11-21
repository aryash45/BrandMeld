use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    middleware,
    routing::{get, post},
};
use serde::Serialize;
use uuid::Uuid;

use crate::{
    domain::classification::{ClassificationResult, classify},
    domain::signal::{CreateSignalRequest, Signal, SignalKind, SignalSource},
    http::auth::require_api_token,
    state::AppState,
};

#[derive(Debug, Serialize)]
struct ErrorResponse {
    error: &'static str,
}

pub fn signal_routes() -> Router<AppState> {
    Router::new()
        .route("/v2/signals", post(create_signal))
        .route("/v2/signals/{id}", get(get_signal))
        .route("/v2/signals/{id}/classify", post(classify_signal))
        .route("/v2/signals/mock-github-release", post(mock_github_release))
}

pub fn protected_signal_routes(state: AppState) -> Router {
    signal_routes()
        .layer(middleware::from_fn_with_state(
            state.clone(),
            require_api_token,
        ))
        .with_state(state)
}

async fn create_signal(
    State(state): State<AppState>,
    Json(request): Json<CreateSignalRequest>,
) -> Result<(StatusCode, Json<Signal>), (StatusCode, Json<ErrorResponse>)> {
    if let Err(error) = request.validate() {
        return Err((StatusCode::BAD_REQUEST, Json(ErrorResponse { error })));
    }
    let signal = request.into_signal();
    state
        .signals
        .write()
        .await
        .insert(signal.id, signal.clone());

    Ok((StatusCode::CREATED, Json(signal)))
}

async fn mock_github_release(
    State(state): State<AppState>,
) -> Result<(StatusCode, Json<Signal>), (StatusCode, Json<ErrorResponse>)> {
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

async fn classify_signal(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<ClassificationResult>, StatusCode> {
    let signal = state
        .signals
        .read()
        .await
        .get(&id)
        .cloned()
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(classify(&(&signal).into())))
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

#[cfg(test)]
mod tests {
    use axum::{body::Body, http::Request};
    use tower::ServiceExt;

    use super::protected_signal_routes;
    use crate::state::AppState;

    #[tokio::test]
    async fn signal_routes_require_and_accept_api_token() {
        let app = protected_signal_routes(AppState::new("test-token"));

        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/v2/signals/mock-github-release")
                    .method("POST")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), 401);

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/v2/signals/mock-github-release")
                    .method("POST")
                    .header("authorization", "Bearer test-token")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), 201);
    }
}
