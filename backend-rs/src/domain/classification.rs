use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::signal::{Signal, SignalKind, SignalSource};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ClassificationStatus {
    Pending,
    Completed,
    NeedsReview,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ClassificationResult {
    pub kind: SignalKind,
    pub confidence: f32,
    pub reason: String,
    pub evidence: Vec<String>,
    pub needs_human_review: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ClassificationRun {
    pub id: Uuid,
    pub signal_id: Uuid,
    pub status: ClassificationStatus,
    pub result: Option<ClassificationResult>,
    pub created_at_epoch_seconds: u64,
    pub completed_at_epoch_seconds: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ClassificationInput {
    pub source: SignalSource,
    pub current_kind: SignalKind,
    pub title: String,
    pub body: String,
    pub repository: Option<String>,
    pub version: Option<String>,
}

impl From<&Signal> for ClassificationInput {
    fn from(signal: &Signal) -> Self {
        Self {
            source: signal.source.clone(),
            current_kind: signal.kind.clone(),
            title: signal.title.clone(),
            body: signal.body.clone(),
            repository: signal.repository.clone(),
            version: signal.version.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{ClassificationInput, ClassificationRun, ClassificationStatus};
    use crate::domain::signal::{CreateSignalRequest, SignalKind, SignalSource};

    #[test]
    fn classification_run_can_start_pending() {
        let run = ClassificationRun {
            id: uuid::Uuid::new_v4(),
            signal_id: uuid::Uuid::new_v4(),
            status: ClassificationStatus::Pending,
            result: None,
            created_at_epoch_seconds: 0,
            completed_at_epoch_seconds: None,
        };

        assert_eq!(run.status, ClassificationStatus::Pending);
        assert!(run.result.is_none());
    }

    #[test]
    fn maps_signal_to_classification_input() {
        let signal = CreateSignalRequest {
            source: SignalSource::GithubRelease,
            kind: SignalKind::NewRelease,
            title: "API v2.3 released".to_owned(),
            body: "Scoped tokens are now required.".to_owned(),
            repository: Some("acme/api".to_owned()),
            version: Some("v2.3.0".to_owned()),
        }
        .into_signal();
        let input = ClassificationInput::from(&signal);

        assert_eq!(input.title, signal.title);
        assert_eq!(input.current_kind, SignalKind::NewRelease);
        assert_eq!(input.repository.as_deref(), Some("acme/api"));
    }
}
