use crate::user::data::{self, OS, default_config_path };
use crate::seq::store::{self, FlushPolicy, SeqStore};
use std::sync::{Arc, Mutex};
use chrono::Utc;

pub mod seq;
pub mod user;


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run(user: data::UserInfo) {
  let store_dir = data::default_data_dir(data::retrieve_os()).unwrap().join("store");
  let seq_store = Arc::new(SeqStore::new(store_dir).expect("could not create sequence store directory"));
  store::spawn_flusher(seq_store.clone(), FlushPolicy::default());

  let app = tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .manage(data::UserState { data: Mutex::new(user)})
    .manage(seq_store.clone())
    .invoke_handler(tauri::generate_handler![
        get_user_info,
        get_config_path,
        save_user_info,
        seq::commands::import_fasta,
        seq::commands::list_records,
        seq::commands::get_window,
        seq::commands::apply_edits,
        seq::commands::search_sequence,
        seq::commands::flush_record])
    .build(tauri::generate_context!())
    .expect("error while building tauri application");

  app.run(move |_app, event| {
    // Don't lose edits that the background flusher hasn't picked up yet.
    if let tauri::RunEvent::Exit = event {
      seq_store.flush_all();
    }
  });
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
