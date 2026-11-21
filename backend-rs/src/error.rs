use std::{net::AddrParseError, num::ParseIntError};

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("BRANDMELD_API_TOKEN is required")]
    MissingApiToken,
    #[error("invalid BRANDMELD_HOST: {source}")]
    InvalidHost { source: AddrParseError },
    #[error("invalid BRANDMELD_PORT: {source}")]
    InvalidPort { source: ParseIntError },
}
