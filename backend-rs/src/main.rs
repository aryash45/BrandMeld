mod config;
mod domain;
mod error;
mod http;
mod state;

use std::net::SocketAddr;

use axum::Router;
use config::AppConfig;
use http::health::health_routes;
use http::signals::signal_routes;
use state::AppState;
use tokio::net::TcpListener;
use tower_http::trace::TraceLayer;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();

    let config = AppConfig::from_env()?;
    let state = AppState::default();
    let app = Router::new()
        .merge(health_routes())
        .merge(signal_routes().with_state(state))
        .layer(TraceLayer::new_for_http());

    let address = SocketAddr::from((config.host, config.port));
    let listener = TcpListener::bind(address).await?;
    tracing::info!(%address, "BrandMeld Rust API listening");

    axum::serve(listener, app).await?;
    Ok(())
}
