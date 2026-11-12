use std::{env, net::IpAddr, str::FromStr};

use crate::error::ConfigError;

#[derive(Debug, Clone)]
pub struct AppConfig {
    pub host: IpAddr,
    pub port: u16,
}

impl AppConfig {
    pub fn from_env() -> Result<Self, ConfigError> {
        let host = env::var("BRANDMELD_HOST")
            .unwrap_or_else(|_| "127.0.0.1".to_owned())
            .parse()
            .map_err(|source| ConfigError::InvalidHost { source })?;
        let port = env::var("BRANDMELD_PORT")
            .unwrap_or_else(|_| "8081".to_owned())
            .parse()
            .map_err(|source| ConfigError::InvalidPort { source })?;

        Ok(Self { host, port })
    }
}

#[allow(dead_code)]
fn _type_checks() {
    let _ = IpAddr::from_str("127.0.0.1");
}
