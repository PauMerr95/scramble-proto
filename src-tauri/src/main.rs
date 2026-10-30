// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use app_lib::user::data::{self, load_config};


#[tokio::main]
async fn main() {
  let config_path = data::default_config_path(data::retrieve_os()).unwrap();
  let work_dir = data::default_work_dir(data::retrieve_os()).unwrap();
  let settings = load_config(&config_path, work_dir).unwrap();
  app_lib::run(settings, config_path);
}
