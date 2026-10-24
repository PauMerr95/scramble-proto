// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use app_lib::user::data::{self, load_config};


#[tokio::main]
async fn main() {
  let _config_path = data::default_config_path(data::retrieve_os()).unwrap();
  let user = load_config(_config_path);
  app_lib::run(user.unwrap());
}
