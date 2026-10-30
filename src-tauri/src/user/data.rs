use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

use std::fs;
use std::path;
use std::sync::Mutex;

pub enum OS {
    Linux,
    Windows,
    Mac
}
// Variants must match `themes` in src/app/types/layout_types.ts
#[derive(Debug, Serialize, Deserialize, Default, Clone, PartialEq)]
pub enum Theme {
    #[default]
    DarkLime,
    Ocean,
    Catpuccin,
    Material,
    Swagger,
    LightBlue,
    LightRed,
    LightGreen,
    Scramble,
    HolyLight,
    Vampire,
    Doom,
    Vanilla,
    Tropical
}

/// Installation-wide settings, persisted to `.config.toml`. Holds the API key, so it never
/// crosses IPC as-is: the frontend gets a `SettingsInfo`.
/// `default` lets configs from older versions (with profile fields, without new ones) load.
#[derive(Debug, Serialize, Deserialize, Default, Clone, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub theme: Theme,
    pub work_dir: path::PathBuf,
    pub last_session_path: Option<String>,
    pub api_key: Option<String>,
    pub api_key_updated_at: Option<DateTime<Utc>>,
}

pub struct SettingsState {
    pub data: Mutex<Settings>,
    /// Where `data` is persisted. Owned by the backend; the frontend only displays it.
    pub config_path: path::PathBuf,
}

// Mirrors `SettingsInfo` in src/app/types/data_types.ts
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SettingsInfo {
    pub theme: Theme,
    pub work_dir: String,
    pub last_session_path: Option<String>,
    pub config_path: String,
    pub api_key: ApiKeyStatus,
}

// Mirrors `ApiKeySource` in src/app/types/data_types.ts
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum ApiKeySource {
    Config,
    Env
}

// Mirrors `ApiKeyStatus` in src/app/types/data_types.ts
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ApiKeyStatus {
    pub available: bool,
    pub source: Option<ApiKeySource>,
    /// Only set for a key from the config; an env key has no update time.
    pub updated_at: Option<DateTime<Utc>>,
}

// Mirrors `SettingsDraft` in src/app/types/data_types.ts (what the Save button sends)
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SettingsDraft {
    pub theme: Theme,
    pub work_dir: String,
    pub last_session_path: Option<String>,
}

impl Settings {
    pub fn new(work_dir: path::PathBuf) -> Settings {
        Self { work_dir, ..Default::default() }
    }

    /// The key to use for NCBI requests: the configured one, else `NCBI_API_KEY`.
    pub fn api_key(&self) -> Option<String> {
        self.api_key.clone().or_else(|| get_api_key_env().ok())
    }

    pub fn api_key_status(&self) -> ApiKeyStatus {
        key_status(self, get_api_key_env().ok())
    }

    pub fn info(&self, config_path: &path::Path) -> SettingsInfo {
        SettingsInfo {
            theme: self.theme.clone(),
            work_dir: self.work_dir.to_string_lossy().into_owned(),
            last_session_path: self.last_session_path.clone(),
            config_path: config_path.to_string_lossy().into_owned(),
            api_key: self.api_key_status(),
        }
    }

    /// Settings with the draft applied. Fails on a work dir that can't be used.
    pub fn with_draft(&self, draft: SettingsDraft) -> Result<Settings, String> {
        let work_dir = path::PathBuf::from(draft.work_dir.trim());
        if work_dir.as_os_str().is_empty() {
            return Err("Work folder must not be empty".to_string());
        }
        if !work_dir.is_absolute() {
            return Err(format!("Work folder must be an absolute path: {}", work_dir.display()));
        }
        Ok(Settings {
            theme: draft.theme,
            work_dir,
            last_session_path: draft.last_session_path,
            ..self.clone()
        })
    }

    pub fn set_api_key(&mut self, key: &str) -> Result<(), String> {
        let key = key.trim();
        if key.is_empty() {
            return Err("API key must not be empty".to_string());
        }
        self.api_key = Some(key.to_string());
        self.api_key_updated_at = Some(Utc::now());
        Ok(())
    }

    pub fn clear_api_key(&mut self) {
        self.api_key = None;
        self.api_key_updated_at = None;
    }
}

fn key_status(settings: &Settings, env_key: Option<String>) -> ApiKeyStatus {
    match (&settings.api_key, env_key) {
        (Some(_), _) => ApiKeyStatus {
            available: true, source: Some(ApiKeySource::Config), updated_at: settings.api_key_updated_at },
        (None, Some(_)) => ApiKeyStatus { available: true, source: Some(ApiKeySource::Env), updated_at: None },
        (None, None) => ApiKeyStatus { available: false, source: None, updated_at: None },
    }
}

fn get_api_key_env() -> Result<String, String> {
    match std::env::var("NCBI_API_KEY") {
        Ok(key) if !key.is_empty() => Ok(key),
        _ => Err("Could not retrieve NCBI_API_KEY from environment".to_string())
    }
}

/// Root for config and sequence data. Deliberately separate from the main Scramble app's
/// directory so the prototype never rewrites its config or store.
pub fn default_data_dir(os: OS) -> Result<path::PathBuf, String> {
    match os {
        OS::Linux   => if let Ok(path) = std::env::var("HOME") {
                Ok(path::PathBuf::from(format!("{path}/.config/scramble-proto")))
            } else {
                Err("Could not resolve HOME path for Linux".to_string())
            }
        OS::Mac     => if let Ok(path) = std::env::var("HOME") {
                Ok(path::PathBuf::from(format!("{path}/Library/Application Support/ScrambleProto")))
            } else {
                Err("Could not resolve HOME path for MacOS".to_string())
            }
        OS::Windows => if let Ok(path) = std::env::var("LOCALAPPDATA") {
            Ok(path::PathBuf::from(format!("{path}\\ScrambleProto")))
        } else if let Ok(path) = std::env::var("HOMEPATH") {
            Ok(path::PathBuf::from(format!("{path}\\AppData\\Local\\ScrambleProto")))
        } else {
            Err("Could not resolve Appdata Directory for Windows".to_string())
        }
    }
}

pub fn default_config_path(os: OS) -> Result<path::PathBuf, String> {
    Ok(default_data_dir(os)?.join(".config.toml"))
}

/// Root of the user's file tree (frontend task 8), unless the settings name another one.
pub fn default_work_dir(os: OS) -> Result<path::PathBuf, String> {
    Ok(default_data_dir(os)?.join("work"))
}

pub fn retrieve_os() -> OS {
    match std::env::consts::OS {
        "linux"     => OS::Linux,
        "windows"   => OS::Windows,
        "macos"     => OS::Mac,
        _ => panic!("Unsupported system detected. Only supporting Linux, Windows and MacOS")
    }
}

pub fn load_config(config_path: &path::Path, default_work_dir: path::PathBuf) -> Result<Settings, String> {
    if !config_path.exists() {
        println!("=== No existing config found, using default settings ===");
        return Ok(Settings::new(default_work_dir));
    }
    let raw = fs::read_to_string(config_path)
        .map_err(|e| format!("Load config read_to_string Error: {}", e))?;
    let mut settings = parse_config(&raw)?;
    if settings.work_dir.as_os_str().is_empty() {
        settings.work_dir = default_work_dir;
    }
    println!("=== Retrieved settings from {} ===", config_path.display());
    Ok(settings)
}

fn parse_config(raw: &str) -> Result<Settings, String> {
    toml::from_str(raw).map_err(|e| format!("Loading config failed on toml parsing: {}", e))
}

pub fn save_to_file(settings: &Settings, config_path: &path::Path) -> Result<(), String> {
    let raw = toml::to_string(settings)
        .map_err(|err| format!("Failed to serialize settings. Error: {}", err))?;
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }
    fs::write(config_path, &raw)
        .map_err(|e| format!("Failed to write settings to file: {}", e))?;
    // Not the file contents: they hold the API key.
    println!("=== Saved settings to {} ===", config_path.display());
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn abs(name: &str) -> path::PathBuf {
        std::env::temp_dir().join(name)
    }

    fn sorted_keys(json: &serde_json::Value) -> Vec<String> {
        let mut keys: Vec<String> = json.as_object().unwrap().keys().cloned().collect();
        keys.sort();
        keys
    }

    #[test]
    fn ipc_json_matches_frontend_settings_info() {
        let mut settings = Settings::new(abs("work"));
        settings.set_api_key("secret-key").unwrap();
        let json = serde_json::to_value(settings.info(&abs(".config.toml"))).unwrap();
        assert_eq!(sorted_keys(&json), ["apiKey", "configPath", "lastSessionPath", "theme", "workDir"]);
        assert_eq!(sorted_keys(&json["apiKey"]), ["available", "source", "updatedAt"]);
        assert_eq!(json["theme"], "DarkLime");
        assert_eq!(json["apiKey"]["available"], true);
        assert_eq!(json["apiKey"]["source"], "Config");
        assert!(json["lastSessionPath"].is_null());
    }

    #[test]
    fn settings_info_never_contains_the_key() {
        let mut settings = Settings::new(abs("work"));
        settings.set_api_key("secret-key").unwrap();
        let raw = serde_json::to_string(&settings.info(&abs(".config.toml"))).unwrap();
        assert!(!raw.contains("secret-key"), "{raw}");
    }

    #[test]
    fn key_status_prefers_config_and_falls_back_to_env() {
        let mut settings = Settings::new(abs("work"));
        let env = Some("env-key".to_string());
        assert_eq!(key_status(&settings, None),
            ApiKeyStatus { available: false, source: None, updated_at: None });
        assert_eq!(key_status(&settings, env.clone()),
            ApiKeyStatus { available: true, source: Some(ApiKeySource::Env), updated_at: None });
        settings.set_api_key("  k  ").unwrap();
        assert_eq!(settings.api_key.as_deref(), Some("k"));
        let status = key_status(&settings, env);
        assert_eq!(status.source, Some(ApiKeySource::Config));
        assert!(status.updated_at.is_some());
        settings.clear_api_key();
        assert!(!key_status(&settings, None).available);
    }

    #[test]
    fn rejects_empty_api_key() {
        let mut settings = Settings::new(abs("work"));
        assert!(settings.set_api_key("   ").is_err());
        assert_eq!(settings.api_key, None);
    }

    #[test]
    fn deserializes_frontend_draft() {
        let payload = r#"{"theme":"Doom","workDir":"/tmp/w","lastSessionPath":null}"#;
        let draft: SettingsDraft = serde_json::from_str(payload).unwrap();
        assert_eq!(draft.theme, Theme::Doom);
        assert_eq!(draft.work_dir, "/tmp/w");
    }

    #[test]
    fn draft_keeps_the_key_and_validates_work_dir() {
        let mut settings = Settings::new(abs("work"));
        settings.set_api_key("k").unwrap();
        let draft = |work_dir: &str| SettingsDraft {
            theme: Theme::Ocean, work_dir: work_dir.to_string(), last_session_path: None };

        let next = settings.with_draft(draft(abs("other").to_str().unwrap())).unwrap();
        assert_eq!((next.theme.clone(), next.work_dir.clone()), (Theme::Ocean, abs("other")));
        assert_eq!(next.api_key.as_deref(), Some("k"));
        assert!(settings.with_draft(draft("  ")).is_err());
        assert!(settings.with_draft(draft("relative/dir")).is_err());
    }

    #[test]
    fn loads_old_profile_config() {
        let raw = r#"
            id = 0
            name = "Test User"
            avatar = "Sheep"
            theme = "Doom"
            apiKey = "k"
            createdAt = "2026-01-01T00:00:00Z"
            updatedAt = "2026-01-01T00:00:00Z"
        "#;
        let settings = parse_config(raw).unwrap();
        assert_eq!(settings.theme, Theme::Doom);
        assert_eq!(settings.api_key.as_deref(), Some("k"));
        assert_eq!(settings.api_key_updated_at, None);
        assert!(settings.work_dir.as_os_str().is_empty());
    }

    #[test]
    fn load_config_fills_default_work_dir() {
        let dir = tempfile::tempdir().unwrap();
        let config = dir.path().join(".config.toml");
        fs::write(&config, "theme = \"Ocean\"\n").unwrap();
        let settings = load_config(&config, dir.path().join("work")).unwrap();
        assert_eq!((settings.theme, settings.work_dir), (Theme::Ocean, dir.path().join("work")));

        let missing = load_config(&dir.path().join("none.toml"), dir.path().join("work")).unwrap();
        assert_eq!(missing, Settings::new(dir.path().join("work")));
    }

    #[test]
    fn config_file_roundtrips() {
        let dir = tempfile::tempdir().unwrap();
        let config = dir.path().join("nested").join(".config.toml");
        let plain = Settings::new(dir.path().join("work"));
        save_to_file(&plain, &config).unwrap();
        assert_eq!(load_config(&config, abs("unused")).unwrap(), plain);

        let mut keyed = plain.clone();
        keyed.set_api_key("k").unwrap();
        keyed.last_session_path = Some("x.fa".to_string());
        save_to_file(&keyed, &config).unwrap();
        assert_eq!(load_config(&config, abs("unused")).unwrap(), keyed);
    }
}
