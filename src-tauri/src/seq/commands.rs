use std::io;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use super::fasta::RecordMeta;
use super::store::SeqStore;
use super::view::EditOp;

type Store<'a> = tauri::State<'a, Arc<SeqStore>>;

/// Runs disk-bound work off the main thread so the webview stays responsive.
async fn blocking<T, F>(store: &Store<'_>, work: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce(&SeqStore) -> io::Result<T> + Send + 'static,
{
    let store = store.inner().clone();
    tauri::async_runtime::spawn_blocking(move || work(&store))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

/// Opens a FASTA/FNA file for editing (or returns its records if it is already open).
#[tauri::command]
pub async fn open_fasta(store: Store<'_>, path: String) -> Result<Vec<RecordMeta>, String> {
    blocking(&store, move |s| s.open_file(&PathBuf::from(path))).await
}

/// Writes an opened file back to its source, or to `path` (save as). `force` overwrites a
/// source changed on disk or an existing `path`.
#[tauri::command]
pub async fn save_file(
    store: Store<'_>,
    file_id: String,
    path: Option<String>,
    force: bool,
) -> Result<Vec<RecordMeta>, String> {
    blocking(&store, move |s| s.save_file(&file_id, path.as_deref().map(Path::new), force)).await
}

/// Closes an opened file and deletes its working copies. `force` discards unsaved changes.
#[tauri::command]
pub async fn close_file(store: Store<'_>, file_id: String, force: bool) -> Result<(), String> {
    blocking(&store, move |s| s.close_file(&file_id, force)).await
}

#[tauri::command]
pub async fn list_records(store: Store<'_>) -> Result<Vec<RecordMeta>, String> {
    blocking(&store, |s| s.list()).await
}

#[tauri::command]
pub async fn get_window(store: Store<'_>, id: String, start: u64, len: u64) -> Result<String, String> {
    blocking(&store, move |s| s.view(&id)?.view.read().unwrap().window(start, len)).await
}

#[tauri::command]
pub async fn apply_edits(store: Store<'_>, id: String, ops: Vec<EditOp>) -> Result<RecordMeta, String> {
    blocking(&store, move |s| s.apply_edits(&id, ops)).await
}

#[tauri::command]
pub async fn search_sequence(
    store: Store<'_>,
    id: String,
    query: String,
    from: u64,
    limit: usize,
) -> Result<Vec<u64>, String> {
    blocking(&store, move |s| s.view(&id)?.view.read().unwrap().search(&query, from, limit)).await
}
