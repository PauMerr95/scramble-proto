//! End-to-end checks of the `invoke` surface: the real command handlers registered by
//! `with_commands`, called with the same camelCase JSON the frontend sends, on tauri's mock
//! runtime. On Windows, build.rs embeds the Common Controls manifest these binaries need.

use app_lib::seq::store::SeqStore;
use app_lib::user::data;
use app_lib::with_commands;
use serde_json::{json, Value};
use std::fs;
use std::sync::Arc;
use tauri::test::{get_ipc_response, mock_builder, mock_context, noop_assets, MockRuntime, INVOKE_KEY};
use tauri::webview::InvokeRequest;

struct Ipc {
  _app: tauri::App<MockRuntime>,
  webview: tauri::WebviewWindow<MockRuntime>,
}

impl Ipc {
  fn new(work_dir: std::path::PathBuf) -> Ipc {
    let store = Arc::new(SeqStore::new(work_dir).unwrap());
    let app = with_commands(mock_builder(), data::UserInfo::new(), store)
      .build(mock_context(noop_assets()))
      .unwrap();
    let webview = tauri::WebviewWindowBuilder::new(&app, "main", Default::default()).build().unwrap();
    Ipc { _app: app, webview }
  }

  /// Same as `invoke(cmd, args)` in the frontend: args are the camelCase JSON it sends.
  fn invoke(&self, cmd: &str, args: Value) -> Result<Value, Value> {
    let request = InvokeRequest {
      cmd: cmd.into(),
      callback: tauri::ipc::CallbackFn(0),
      error: tauri::ipc::CallbackFn(1),
      url: if cfg!(windows) { "http://tauri.localhost" } else { "tauri://localhost" }.parse().unwrap(),
      body: tauri::ipc::InvokeBody::Json(args),
      headers: Default::default(),
      invoke_key: INVOKE_KEY.to_string(),
    };
    get_ipc_response(&self.webview, request).map(|body| body.deserialize::<Value>().unwrap())
  }
}

// Mirrors the calls made by src/app/services/sequence-store-service.ts.
#[test]
fn open_edit_save_close_roundtrip_over_ipc() {
  let dir = tempfile::tempdir().unwrap();
  let src = dir.path().join("genome.fna");
  fs::write(&src, ">chr1\nACGT\n>chr2\nGG\n").unwrap();
  let ipc = Ipc::new(dir.path().join("tmp"));

  let opened = ipc.invoke("open_fasta", json!({ "path": src })).unwrap();
  let (id, file_id) = (opened[0]["id"].clone(), opened[0]["fileId"].clone());
  assert_eq!(opened.as_array().unwrap().len(), 2);
  assert_eq!(opened[0]["modified"], false);

  let meta = ipc.invoke("apply_edits", json!({ "id": id, "ops": [{ "kind": "insert", "offset": 4, "bases": "NN" }] })).unwrap();
  assert_eq!((meta["length"].clone(), meta["modified"].clone()), (json!(6), json!(true)));
  assert_eq!(ipc.invoke("get_window", json!({ "id": id, "start": 2, "len": 10 })).unwrap(), "GTNN");

  let err = ipc.invoke("close_file", json!({ "fileId": file_id, "force": false })).unwrap_err();
  assert!(err.as_str().unwrap().contains("unsaved changes"), "{err}");

  let saved = ipc.invoke("save_file", json!({ "fileId": file_id, "path": null, "force": false })).unwrap();
  assert_eq!(saved[0]["modified"], false);
  assert_eq!(fs::read_to_string(&src).unwrap(), ">chr1\nACGTNN\n>chr2\nGG\n");

  ipc.invoke("close_file", json!({ "fileId": file_id, "force": false })).unwrap();
  assert_eq!(ipc.invoke("list_records", json!({})).unwrap(), json!([]));
}

#[test]
fn session_is_restored_by_a_new_app_instance() {
  let dir = tempfile::tempdir().unwrap();
  let src = dir.path().join("x.fa");
  fs::write(&src, ">x\nACGT\n").unwrap();

  let first = Ipc::new(dir.path().join("tmp"));
  let id = first.invoke("open_fasta", json!({ "path": src })).unwrap()[0]["id"].clone();
  drop(first);

  let second = Ipc::new(dir.path().join("tmp"));
  let listed = second.invoke("list_records", json!({})).unwrap();
  assert_eq!(listed[0]["id"], id);
  let save_as = dir.path().join("y.fa");
  let saved = second.invoke("save_file", json!({ "fileId": listed[0]["fileId"], "path": save_as, "force": false })).unwrap();
  assert_eq!(saved[0]["source"], save_as.to_str().unwrap());
  assert_eq!(fs::read_to_string(save_as).unwrap(), ">x\nACGT\n");
}
