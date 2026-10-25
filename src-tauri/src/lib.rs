use crate::user::data::{self, OS, default_config_path };
use crate::seq::store::{self, FlushPolicy, SeqStore};
use std::sync::{Arc, Mutex};
use chrono::Utc;

pub mod seq;
pub mod user;


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run(user: data::UserInfo) {
  // Working copies of opened files; they stay until the file is closed (see seq::workspace).
  let work_dir = data::default_data_dir(data::retrieve_os()).unwrap().join("tmp");
  let seq_store = Arc::new(SeqStore::new(work_dir).expect("could not create sequence working directory"));
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
  let app = with_commands(builder, user, seq_store.clone())
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
pub fn with_commands<R: tauri::Runtime>(builder: tauri::Builder<R>, user: data::UserInfo, seq_store: Arc<SeqStore>) -> tauri::Builder<R> {
  builder
    .manage(data::UserState { data: Mutex::new(user)})
    .manage(seq_store)
    .invoke_handler(tauri::generate_handler![
        get_user_info,
        get_config_path,
        save_user_info,
        seq::commands::open_fasta,
        seq::commands::save_file,
        seq::commands::close_file,
        seq::commands::list_records,
        seq::commands::get_window,
        seq::commands::apply_edits,
        seq::commands::search_sequence])
}

#[tauri::command]
fn get_user_info(user_state: tauri::State<data::UserState>) -> data::UserInfo {
  let user = user_state.data.lock().unwrap().clone();
  user
}

#[tauri::command]
fn get_config_path() -> String {
  let os: OS = user::data::retrieve_os();
  default_config_path(os).unwrap().to_string_lossy().into_owned()
}

#[tauri::command]
fn save_user_info(user_state: tauri::State<data::UserState>, mut user_data: data::UserInfo, config_path: String) -> Result<data::UserInfo, String> {
  user_data.updated_at = Utc::now();
  let mut user_backend = user_state.data.lock().unwrap();
  *user_backend = user_data.clone();
  user::data::save_to_file(&user_data, &config_path)?;
  Ok(user_data)
}

