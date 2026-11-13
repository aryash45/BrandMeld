use std::{collections::HashMap, sync::Arc};

use tokio::sync::RwLock;
use uuid::Uuid;

use crate::domain::signal::Signal;

#[derive(Clone, Default)]
pub struct AppState {
    pub signals: Arc<RwLock<HashMap<Uuid, Signal>>>,
}
