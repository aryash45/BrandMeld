use std::{collections::HashMap, sync::Arc};

use tokio::sync::RwLock;
use uuid::Uuid;

use crate::domain::signal::Signal;

#[derive(Clone)]
pub struct AppState {
    pub api_token: Arc<str>,
    // shortcut: in-memory state is for the first vertical slice; replace with Postgres before multi-instance use.
    pub signals: Arc<RwLock<HashMap<Uuid, Signal>>>,
}

impl AppState {
    pub fn new(api_token: impl Into<Arc<str>>) -> Self {
        Self {
            api_token: api_token.into(),
            ..Self::default()
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            api_token: Arc::from("test-token"),
            signals: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}
