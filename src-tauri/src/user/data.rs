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
// Variants must match `avatars` in src/app/types/side_types.ts
#[derive(Debug, Serialize, Deserialize, Default, Clone, PartialEq)]
pub enum Avatar {
    Bird,
    Duck,
    Earth,
    Falling,
    #[default]
    Sheep,
    Squirrel
}

pub struct UserState {
    pub data: Mutex<UserInfo>,
}

// Mirrors `UserInfo` in src/app/types/data_types.ts (camelCase over IPC and in the config file).
#[derive(Debug, Serialize, Deserialize, Default, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UserInfo {
    pub id: u32,
    pub name: String,
    pub avatar: Avatar,
    pub theme: Theme,
    pub api_key: Option<String>,
    pub last_session_path: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl UserInfo {
    pub fn new() -> UserInfo {
        let name= String::from("Test User");
        let avatar = Avatar::Sheep;
        let theme = Theme::DarkLime;
        let api_key  = get_api_key_env().ok();
        let last_session_path = None;
        let timestamp = Utc::now();
        Self {id: 0, name, avatar, theme, api_key, last_session_path, created_at: timestamp, updated_at: timestamp}
    }
}

#[derive(Serialize, Deserialize, Default)]
pub struct ScrambleConfig {
    pub config_path: path::PathBuf,
    pub nucl_db_path: path::PathBuf,
    // add config
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

pub fn retrieve_os() -> OS {
    match std::env::consts::OS {
        "linux"     => OS::Linux,
        "windows"   => OS::Windows,
        "macos"     => OS::Mac,
        _ => panic!("Unsupported system detected. Only supporting Linux, Windows and MacOS")
    }
}

pub fn load_config(config_path: path::PathBuf) -> Result<UserInfo, String> {
    if config_path.exists() {
        let raw = fs::read_to_string(config_path)
        .map_err(|_| "Load config read_to_string Error: std::io::Error".to_string())?;
        let user: Result<UserInfo, String> = toml::from_str(&raw).map_err(|e| format!("Loading config failed on toml parsing: {}", e));
        match user {
            Ok(user_info) => {
                println!("=== Retrieved user info from file ===");
                dbg!(&user_info);
                Ok(user_info)
            },
            Err(error) => Err(error)
        }
    } else {
        let user_info = UserInfo::new();
        println!("=== No existing user found, creating default user ===");
        dbg!(&user_info);
        Ok(user_info)
    }
}

pub fn save_to_file(user_data: &UserInfo, config_path: &str) -> Result<(), String>{
    let raw = toml::to_string(&user_data)
        .map_err(|err| format!("Failed to serialize data. Error: {}", err.to_string()))?;
    if let Some(parent) = path::Path::new(&config_path).parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }
    fs::write(config_path, &raw)
        .map_err(|e| format!("Failed to write serialize UserData to file: {}", e))?;
    println!("=== Saved user info to file ===\n{}", raw);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ipc_json_matches_frontend_user_info() {
        let mut user = UserInfo::new();
        user.api_key = None;
        let json = serde_json::to_value(&user).unwrap();
        let mut keys: Vec<&str> = json.as_object().unwrap().keys().map(|k| k.as_str()).collect();
        keys.sort();
        assert_eq!(keys, ["apiKey", "avatar", "createdAt", "id", "lastSessionPath", "name", "theme", "updatedAt"]);
        assert!(json["apiKey"].is_null());
        assert_eq!(json["avatar"], "Sheep");
        assert_eq!(json["theme"], "DarkLime");
    }

    #[test]
    fn deserializes_frontend_payload() {
        let payload = r#"{"id":1,"name":"N","avatar":"Falling","theme":"Doom","apiKey":"k",
            "lastSessionPath":null,"createdAt":"2026-01-01T00:00:00.000Z","updatedAt":"2026-01-01T00:00:00.000Z"}"#;
        let user: UserInfo = serde_json::from_str(payload).unwrap();
        assert_eq!(user.theme, Theme::Doom);
        assert_eq!(user.api_key.as_deref(), Some("k"));
    }

    #[test]
    fn config_file_roundtrips_without_optional_fields() {
        let mut user = UserInfo::new();
        user.api_key = None;
        let raw = toml::to_string(&user).unwrap();
        assert_eq!(toml::from_str::<UserInfo>(&raw).unwrap(), user);
    }
}
