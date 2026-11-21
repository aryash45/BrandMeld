use std::{env, net::IpAddr, str::FromStr};

use crate::error::ConfigError;

#[derive(Debug, Clone)]
pub struct AppConfig {
    pub host: IpAddr,
    pub port: u16,
    pub api_token: String,
}

impl AppConfig {
    pub fn from_env() -> Result<Self, ConfigError> {
        let host = env::var("BRANDMELD_HOST")
            .unwrap_or_else(|_| "0.0.0.0".to_owned())
            .parse()
            .map_err(|source| ConfigError::InvalidHost { source })?;
        let port = env::var("PORT")
            .or_else(|_| env::var("BRANDMELD_PORT"))
            .unwrap_or_else(|_| "8081".to_owned())
            .parse()
            .map_err(|source| ConfigError::InvalidPort { source })?;
        let api_token = env::var("BRANDMELD_API_TOKEN")
            .ok()
            .filter(|token| !token.trim().is_empty())
            .ok_or(ConfigError::MissingApiToken)?;

        Ok(Self {
            host,
            port,
            api_token,
        })
    }
}

#[allow(dead_code)]
fn _type_checks() {
    let _ = IpAddr::from_str("127.0.0.1");
}
