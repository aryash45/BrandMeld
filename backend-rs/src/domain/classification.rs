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

pub fn classify(input: &ClassificationInput) -> ClassificationResult {
    let text = format!("{} {}", input.title, input.body).to_lowercase();
    let rules = [
        (
            SignalKind::SecurityUpdate,
            ["security", "vulnerability", "cve", "credential"].as_slice(),
            "Security-related language was found.",
        ),
        (
            SignalKind::BreakingChange,
            ["breaking", "no longer supported", "migration required"].as_slice(),
            "Breaking-change language was found.",
        ),
        (
            SignalKind::Deprecation,
            ["deprecat", "sunset"].as_slice(),
            "Deprecation language was found.",
        ),
        (
            SignalKind::BugFix,
            ["bug fix", "bugfix", "fixed", "patch"].as_slice(),
            "Bug-fix language was found.",
        ),
        (
            SignalKind::PerformanceChange,
            ["performance", "faster", "latency", "throughput"].as_slice(),
            "Performance language was found.",
        ),
        (
            SignalKind::FeatureUpdate,
            ["feature", "introducing", "now supports", "added"].as_slice(),
            "Feature-update language was found.",
        ),
    ];

    for (kind, markers, reason) in rules {
        if let Some(marker) = markers.iter().find(|marker| text.contains(**marker)) {
            return ClassificationResult {
                kind,
                confidence: 0.9,
                reason: reason.to_owned(),
                evidence: vec![(*marker).to_owned()],
                needs_human_review: false,
            };
        }
    }

    ClassificationResult {
        kind: input.current_kind.clone(),
        confidence: 0.55,
        reason: "No stronger classification signal was found; kept the source kind.".to_owned(),
        evidence: Vec::new(),
        needs_human_review: true,
    }
}

#[cfg(test)]
mod tests {
    use super::{ClassificationInput, ClassificationRun, ClassificationStatus, classify};
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

    #[test]
    fn classifies_security_update_from_release_text() {
        let input = ClassificationInput {
            source: SignalSource::GithubRelease,
            current_kind: SignalKind::NewRelease,
            title: "Security patch for token validation".to_owned(),
            body: "Fixes a credential exposure vulnerability.".to_owned(),
            repository: None,
            version: Some("v2.4.0".to_owned()),
        };

        let result = classify(&input);

        assert_eq!(result.kind, SignalKind::SecurityUpdate);
        assert_eq!(result.confidence, 0.9);
        assert!(!result.needs_human_review);
    }

    #[test]
    fn keeps_source_kind_when_text_is_ambiguous() {
        let input = ClassificationInput {
            source: SignalSource::GithubRelease,
            current_kind: SignalKind::NewRelease,
            title: "API v2.3 released".to_owned(),
            body: "General maintenance updates.".to_owned(),
            repository: None,
            version: Some("v2.3.0".to_owned()),
        };

        let result = classify(&input);

        assert_eq!(result.kind, SignalKind::NewRelease);
        assert!(result.needs_human_review);
    }
}
