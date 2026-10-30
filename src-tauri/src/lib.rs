use crate::user::data;
use crate::seq::store::{self, FlushPolicy, SeqStore};
use std::sync::{Arc, Mutex};

pub mod seq;
pub mod user;


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run(settings: data::Settings, config_path: std::path::PathBuf) {
  // Working copies of opened files; they stay until the file is closed (see seq::workspace).
  let store_dir = data::default_data_dir(data::retrieve_os()).unwrap().join("tmp");
  let seq_store = Arc::new(SeqStore::new(store_dir).expect("could not create sequence working directory"));
  store::spawn_flusher(seq_store.clone(), FlushPolicy::default());

  let builder = tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    });
  let app = with_commands(builder, settings, config_path, seq_store.clone())
    .build(tauri::generate_context!())
    .expect("error while building tauri application");

  app.run(move |_app, event| {
    // Don't lose edits that the background flusher hasn't picked up yet.
    if let tauri::RunEvent::Exit = event {
      seq_store.flush_all();
    }
  });
}

/// Managed state and every `invoke` command. Generic over the runtime so the IPC tests can run
/// the same handlers on tauri's mock runtime.
pub fn with_commands<R: tauri::Runtime>(builder: tauri::Builder<R>, settings: data::Settings, config_path: std::path::PathBuf,
                                         seq_store: Arc<SeqStore>) -> tauri::Builder<R> {
  builder
    .manage(data::SettingsState { data: Mutex::new(settings), config_path })
    .manage(seq_store)
    .invoke_handler(tauri::generate_handler![
        get_settings,
        save_settings,
        set_api_key,
        clear_api_key,
        seq::commands::open_fasta,
        seq::commands::save_file,
        seq::commands::close_file,
        seq::commands::list_records,
        seq::commands::get_window,
        seq::commands::apply_edits,
        seq::commands::search_sequence])
}

#[tauri::command]
fn get_settings(state: tauri::State<data::SettingsState>) -> data::SettingsInfo {
  state.data.lock().unwrap().info(&state.config_path)
}

/// Applies the draft (theme, work folder) and persists it. The work folder is created if missing.
#[tauri::command]
fn save_settings(state: tauri::State<data::SettingsState>, draft: data::SettingsDraft) -> Result<data::SettingsInfo, String> {
  let mut settings = state.data.lock().unwrap();
  let next = settings.with_draft(draft)?;
  std::fs::create_dir_all(&next.work_dir)
    .map_err(|e| format!("Could not create work folder {}: {}", next.work_dir.display(), e))?;
  data::save_to_file(&next, &state.config_path)?;
  *settings = next;
  Ok(settings.info(&state.config_path))
}

/// Stores the key and persists it right away. The key itself is never sent back.
#[tauri::command]
fn set_api_key(state: tauri::State<data::SettingsState>, key: String) -> Result<data::ApiKeyStatus, String> {
  let mut settings = state.data.lock().unwrap();
  let mut next = settings.clone();
  next.set_api_key(&key)?;
  data::save_to_file(&next, &state.config_path)?;
  *settings = next;
  Ok(settings.api_key_status())
}

/// Removes the configured key; `NCBI_API_KEY` may still make one available.
#[tauri::command]
fn clear_api_key(state: tauri::State<data::SettingsState>) -> Result<data::ApiKeyStatus, String> {
  let mut settings = state.data.lock().unwrap();
  let mut next = settings.clone();
  next.clear_api_key();
  data::save_to_file(&next, &state.config_path)?;
  *settings = next;
  Ok(settings.api_key_status())
}
