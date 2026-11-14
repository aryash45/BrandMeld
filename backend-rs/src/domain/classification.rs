use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::signal::SignalKind;

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

#[cfg(test)]
mod tests {
    use super::{ClassificationRun, ClassificationStatus};

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
}
