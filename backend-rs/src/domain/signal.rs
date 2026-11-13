use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SignalSource {
    Manual,
    GithubRelease,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SignalKind {
    NewRelease,
    FeatureUpdate,
    BreakingChange,
    BugFix,
    SecurityUpdate,
    Deprecation,
    PerformanceChange,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Signal {
    pub id: Uuid,
    pub source: SignalSource,
    pub kind: SignalKind,
    pub title: String,
    pub body: String,
    pub repository: Option<String>,
    pub version: Option<String>,
    pub created_at_epoch_seconds: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateSignalRequest {
    pub source: SignalSource,
    pub kind: SignalKind,
    pub title: String,
    pub body: String,
    pub repository: Option<String>,
    pub version: Option<String>,
}

impl CreateSignalRequest {
    pub fn into_signal(self) -> Signal {
        Signal {
            id: Uuid::new_v4(),
            source: self.source,
            kind: self.kind,
            title: self.title,
            body: self.body,
            repository: self.repository,
            version: self.version,
            created_at_epoch_seconds: now_epoch_seconds(),
        }
    }
}

fn now_epoch_seconds() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |duration| duration.as_secs())
}

#[cfg(test)]
mod tests {
    use super::{CreateSignalRequest, SignalKind, SignalSource};

    #[test]
    fn creates_github_release_signal_with_source_metadata() {
        let signal = CreateSignalRequest {
            source: SignalSource::GithubRelease,
            kind: SignalKind::NewRelease,
            title: "API v2.3 released".to_owned(),
            body: "Authentication now requires scoped tokens.".to_owned(),
            repository: Some("acme/payments-api".to_owned()),
            version: Some("v2.3.0".to_owned()),
        }
        .into_signal();

        assert_eq!(signal.source, SignalSource::GithubRelease);
        assert_eq!(signal.kind, SignalKind::NewRelease);
        assert_eq!(signal.repository.as_deref(), Some("acme/payments-api"));
        assert_eq!(signal.version.as_deref(), Some("v2.3.0"));
        assert!(!signal.id.is_nil());
    }
}
