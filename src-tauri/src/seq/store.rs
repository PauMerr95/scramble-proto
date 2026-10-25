use std::collections::{HashMap, HashSet};
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, RwLock};
use std::thread;
use std::time::Duration;

use super::fasta::{self, RecordMeta};
use super::invalid_input;
use super::view::{EditOp, RecordView, Snapshot};
use super::workspace::{self, FileStamp, OpenFile};

/// When the background flusher writes a record back to disk.
#[derive(Debug, Clone, Copy)]
pub struct FlushPolicy {
    /// How often the flusher checks for dirty records.
    pub tick: Duration,
    /// Flush once no edit arrived for this long...
    pub idle: Duration,
    /// ...or as soon as this many edits are pending.
    pub max_pending: usize,
}

impl Default for FlushPolicy {
    fn default() -> Self {
        FlushPolicy { tick: Duration::from_millis(500), idle: Duration::from_secs(2), max_pending: 1000 }
    }
}

pub struct ViewHandle {
    pub view: RwLock<RecordView>,
    /// Serialises flushes of the same record; edits and reads stay unblocked while writing.
    flush_lock: Mutex<()>,
}

pub struct SeqStore {
    dir: PathBuf,
    views: Mutex<HashMap<String, Arc<ViewHandle>>>,
    /// Serialises open/save/close so two of them never race on the same manifest.
    files_lock: Mutex<()>,
}

impl SeqStore {
    pub fn new(dir: PathBuf) -> io::Result<SeqStore> {
        fs::create_dir_all(&dir)?;
        let store = SeqStore { dir, views: Mutex::new(HashMap::new()), files_lock: Mutex::new(()) };
        store.sweep()?;
        Ok(store)
    }

    pub fn dir(&self) -> &Path {
        &self.dir
    }

    /// Removes what an interrupted flush or open left behind: `*.tmp` files and records whose
    /// file has no manifest.
    fn sweep(&self) -> io::Result<()> {
        let open: HashSet<String> = workspace::list_manifests(&self.dir)?.into_iter().map(|f| f.id).collect();
        for entry in fs::read_dir(&self.dir)? {
            let path = entry?.path();
            let name = path.file_name().and_then(|n| n.to_str()).unwrap_or_default();
            if name.ends_with(".tmp") {
                fs::remove_file(&path)?;
            } else if let Some(id) = name.strip_suffix(".json").filter(|id| fasta::is_valid_record_id(id)) {
                if fasta::load_meta(&self.dir, id).is_ok_and(|meta| !open.contains(&meta.file_id)) {
                    fasta::remove_record(&self.dir, id)?;
                }
            }
        }
        Ok(())
    }

    /// Opens a FASTA/FNA file for editing: copies its records into the store and remembers the
    /// source for saving. A file that is already open returns its existing records.
    pub fn open_file(&self, path: &Path) -> io::Result<Vec<RecordMeta>> {
        let _files = self.files_lock.lock().unwrap();
        let path = std::path::absolute(path)?;
        for file in workspace::list_manifests(&self.dir)? {
            if workspace::same_file(&path, Path::new(&file.path)) {
                return self.records_of(&file);
            }
        }

        let stamp = FileStamp::of(&path)?;
        let file_id = fasta::new_record_id();
        let metas = fasta::import(&path, &self.dir, &file_id)?;
        let file = OpenFile {
            id: file_id,
            path: path.to_string_lossy().into_owned(),
            stamp,
            records: metas.iter().map(|m| m.id.clone()).collect(),
        };
        let saved = if metas.is_empty() {
            Err(io::Error::new(io::ErrorKind::InvalidData, format!("no FASTA records in {}", path.display())))
        } else {
            workspace::save_manifest(&self.dir, &file)
        };
        if let Err(e) = saved {
            for meta in &metas {
                let _ = fasta::remove_record(&self.dir, &meta.id);
            }
            return Err(e);
        }
        Ok(metas)
    }

    /// Writes every record of an opened file as FASTA, to its source or to `target` (which then
    /// becomes the file's new source). Without `force` it refuses to overwrite a source that
    /// changed on disk since it was opened, or an existing `target`.
    pub fn save_file(&self, file_id: &str, target: Option<&Path>, force: bool) -> io::Result<Vec<RecordMeta>> {
        let _files = self.files_lock.lock().unwrap();
        let mut file = self.manifest(file_id)?;
        let target = match target {
            Some(path) => std::path::absolute(path)?,
            None => PathBuf::from(&file.path),
        };
        if !force {
            if workspace::same_file(&target, Path::new(&file.path)) {
                // A deleted source is simply written again.
                if FileStamp::of(&target).is_ok_and(|now| now != file.stamp) {
                    return Err(io::Error::new(
                        io::ErrorKind::AlreadyExists,
                        format!("{} changed on disk since it was opened (use :w! to overwrite)", target.display()),
                    ));
                }
            } else if target.exists() {
                return Err(io::Error::new(
                    io::ErrorKind::AlreadyExists,
                    format!("{} already exists (use :w! to overwrite)", target.display()),
                ));
            }
        }

        let handles = file.records.iter().map(|id| self.view(id)).collect::<io::Result<Vec<_>>>()?;
        // Holding every flush lock keeps the base files in place while the snapshots read them.
        let _flushing: Vec<_> = handles.iter().map(|h| h.flush_lock.lock().unwrap()).collect();
        let snaps: Vec<Snapshot> = handles.iter().map(|h| h.view.read().unwrap().snapshot()).collect();

        let tmp = workspace::export_tmp_path(&target);
        if let Err(e) = workspace::write_fasta(&tmp, &snaps).and_then(|_| fs::rename(&tmp, &target)) {
            let _ = fs::remove_file(&tmp);
            return Err(e);
        }

        file.path = target.to_string_lossy().into_owned();
        file.stamp = FileStamp::of(&target)?;
        workspace::save_manifest(&self.dir, &file)?;
        let mut metas = Vec::new();
        for (handle, snap) in handles.iter().zip(&snaps) {
            let mut view = handle.view.write().unwrap();
            view.mark_saved(&self.dir, snap.revision, &file.path)?;
            metas.push(view.meta.clone());
        }
        Ok(metas)
    }

    /// Closes an opened file and deletes its working copies. Without `force` it refuses while
    /// the file has unsaved changes.
    pub fn close_file(&self, file_id: &str, force: bool) -> io::Result<()> {
        let _files = self.files_lock.lock().unwrap();
        let file = self.manifest(file_id)?;
        if !force && self.records_of(&file)?.iter().any(|m| m.modified) {
            return Err(invalid_input(format!("{} has unsaved changes (use :q! to discard them)", file.path)));
        }

        let handles: Vec<Arc<ViewHandle>> = {
            let mut views = self.views.lock().unwrap();
            file.records.iter().filter_map(|id| views.remove(id)).collect()
        };
        for handle in handles {
            // Waits for a running flush; the flusher skips a view without pending ops.
            let _flushing = handle.flush_lock.lock().unwrap();
            handle.view.write().unwrap().discard();
        }
        // Manifest first: records left behind by a failure here are swept on the next start.
        fs::remove_file(workspace::manifest_path(&self.dir, &file.id))?;
        for id in &file.records {
            fasta::remove_record(&self.dir, id)?;
        }
        Ok(())
    }

    fn manifest(&self, file_id: &str) -> io::Result<OpenFile> {
        if !fasta::is_valid_record_id(file_id) {
            return Err(invalid_input(format!("invalid file id '{file_id}'")));
        }
        workspace::load_manifest(&self.dir, file_id)
    }

    /// Records of an opened file in file order, with the live state of opened views.
    fn records_of(&self, file: &OpenFile) -> io::Result<Vec<RecordMeta>> {
        let open = self.views.lock().unwrap().clone();
        file.records
            .iter()
            .map(|id| match open.get(id) {
                Some(handle) => Ok(handle.view.read().unwrap().meta.clone()),
                None => fasta::load_meta(&self.dir, id),
            })
            .collect()
    }

    /// All stored records; opened records report their live (unflushed) state.
    pub fn list(&self) -> io::Result<Vec<RecordMeta>> {
        let open = self.views.lock().unwrap().clone();
        let mut metas = Vec::new();
        for entry in fs::read_dir(&self.dir)? {
            let path = entry?.path();
            if path.extension().is_none_or(|ext| ext != "json") {
                continue;
            }
            let Some(id) = path.file_stem().and_then(|s| s.to_str()) else { continue };
            if !fasta::is_valid_record_id(id) {
                continue;
            }
            match open.get(id) {
                Some(handle) => metas.push(handle.view.read().unwrap().meta.clone()),
                None => metas.push(fasta::load_meta(&self.dir, id)?),
            }
        }
        // Ids start with a timestamp, so this is import order.
        metas.sort_by(|a, b| a.id.cmp(&b.id));
        Ok(metas)
    }

    pub fn view(&self, id: &str) -> io::Result<Arc<ViewHandle>> {
        if !fasta::is_valid_record_id(id) {
            return Err(invalid_input(format!("invalid record id '{id}'")));
        }
        let mut views = self.views.lock().unwrap();
        if let Some(handle) = views.get(id) {
            return Ok(handle.clone());
        }
        let meta = fasta::load_meta(&self.dir, id)?;
        let handle = Arc::new(ViewHandle {
            view: RwLock::new(RecordView::open(&self.dir, meta)),
            flush_lock: Mutex::new(()),
        });
        views.insert(id.to_string(), handle.clone());
        Ok(handle)
    }

    /// Applies ops in order. On an invalid op the earlier ones stay applied and the error is
    /// returned, so the caller should re-read the record's metadata.
    pub fn apply_edits(&self, id: &str, ops: Vec<EditOp>) -> io::Result<RecordMeta> {
        let handle = self.view(id)?;
        let mut view = handle.view.write().unwrap();
        for op in ops {
            view.apply(op)?;
        }
        Ok(view.meta.clone())
    }

    /// Writes pending edits of one record to disk. Returns false if there was nothing to write.
    pub fn flush(&self, handle: &ViewHandle) -> io::Result<bool> {
        let _flushing = handle.flush_lock.lock().unwrap();
        let (snap, id) = {
            let view = handle.view.read().unwrap();
            if view.pending_ops() == 0 {
                return Ok(false);
            }
            (view.snapshot(), view.meta.id.clone())
        };
        // The expensive part runs without the view lock: edits and window reads continue.
        let tmp = fasta::tmp_path(&self.dir, &id);
        let written = match snap.write_to(&tmp) {
            Ok(len) => len,
            Err(e) => {
                let _ = fs::remove_file(&tmp);
                return Err(e);
            }
        };
        handle.view.write().unwrap().commit(&self.dir, snap, &tmp, written)?;
        Ok(true)
    }

    pub fn flush_id(&self, id: &str) -> io::Result<bool> {
        let handle = self.view(id)?;
        self.flush(&handle)
    }

    pub fn flush_due(&self, policy: &FlushPolicy) {
        self.flush_where(|view| {
            view.pending_ops() >= policy.max_pending
                || view.last_edit.is_some_and(|t| t.elapsed() >= policy.idle)
        });
    }

    pub fn flush_all(&self) {
        self.flush_where(|_| true);
    }

    fn flush_where(&self, due: impl Fn(&RecordView) -> bool) {
        let handles: Vec<Arc<ViewHandle>> = self.views.lock().unwrap().values().cloned().collect();
        for handle in handles {
            let is_due = {
                let view = handle.view.read().unwrap();
                view.pending_ops() > 0 && due(&view)
            };
            if is_due {
                if let Err(e) = self.flush(&handle) {
                    log::error!("Flushing record failed: {e}");
                }
            }
        }
    }
}

/// Starts the thread that writes collected edits back to disk in the background.
pub fn spawn_flusher(store: Arc<SeqStore>, policy: FlushPolicy) -> thread::JoinHandle<()> {
    thread::Builder::new()
        .name("seq-flusher".into())
        .spawn(move || loop {
            thread::sleep(policy.tick);
            store.flush_due(&policy);
        })
        .expect("failed to spawn sequence flusher thread")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn store_with(seq: &str) -> (tempfile::TempDir, SeqStore, String) {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("in.fasta");
        fs::write(&src, format!(">t\n{seq}\n")).unwrap();
        let store = SeqStore::new(dir.path().join("tmp")).unwrap();
        let id = store.open_file(&src).unwrap().remove(0).id;
        (dir, store, id)
    }

    /// Two records with a comment, opened from `<tmp>/genome.fna`.
    fn store_with_file() -> (tempfile::TempDir, SeqStore, Vec<RecordMeta>) {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("genome.fna");
        fs::write(&src, format!(">chr1 test\n;made by hand\n{}\n>chr2\nGGCC\n", "ACGT".repeat(20))).unwrap();
        let store = SeqStore::new(dir.path().join("tmp")).unwrap();
        let metas = store.open_file(&src).unwrap();
        (dir, store, metas)
    }

    fn insert(offset: u64, bases: &str) -> Vec<EditOp> {
        vec![EditOp::Insert { offset, bases: bases.into() }]
    }

    fn store_files(store: &SeqStore) -> Vec<String> {
        let mut names: Vec<String> = fs::read_dir(store.dir()).unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().into_owned()).collect();
        names.sort();
        names
    }

    #[test]
    fn open_file_groups_records_and_reopening_returns_them() {
        let (dir, store, metas) = store_with_file();
        assert_eq!(metas.len(), 2);
        assert_eq!(metas[0].file_id, metas[1].file_id);
        assert_eq!(metas[0].comments, vec!["made by hand"]);

        let again = store.open_file(&dir.path().join(".").join("genome.fna")).unwrap();
        assert_eq!(again, metas);
        assert_eq!(store.list().unwrap().len(), 2, "no second working copy");
    }

    #[test]
    fn save_writes_all_records_back_as_fasta() {
        let (dir, store, metas) = store_with_file();
        store.apply_edits(&metas[1].id, insert(4, "TT")).unwrap();
        assert!(store.list().unwrap()[1].modified);

        let saved = store.save_file(&metas[0].file_id, None, false).unwrap();
        assert!(saved.iter().all(|m| !m.modified));
        let written = fs::read_to_string(dir.path().join("genome.fna")).unwrap();
        let acgt = "ACGT".repeat(20);
        assert_eq!(written, format!(">chr1 test\n;made by hand\n{}\n{}\n>chr2\nGGCCTT\n", &acgt[..60], &acgt[60..]));
        assert!(!store_files(&store).iter().any(|n| n.ends_with(".tmp")));
        assert!(!dir.path().join("genome.fna.scramble.tmp").exists());
    }

    #[test]
    fn save_refuses_a_source_changed_on_disk_unless_forced() {
        let (dir, store, metas) = store_with_file();
        let src = dir.path().join("genome.fna");
        fs::write(&src, ">changed elsewhere\nA\n").unwrap();

        let err = store.save_file(&metas[0].file_id, None, false).unwrap_err();
        assert_eq!(err.kind(), io::ErrorKind::AlreadyExists);
        assert!(fs::read_to_string(&src).unwrap().starts_with(">changed elsewhere"));

        store.save_file(&metas[0].file_id, None, true).unwrap();
        assert!(fs::read_to_string(&src).unwrap().starts_with(">chr1 test"));
        // The new stamp is remembered, so the next plain save works.
        store.save_file(&metas[0].file_id, None, false).unwrap();
    }

    #[test]
    fn save_as_switches_the_source_and_protects_existing_files() {
        let (dir, store, metas) = store_with_file();
        let copy = dir.path().join("copy.fa");
        store.save_file(&metas[0].file_id, Some(&copy), false).unwrap();
        assert!(fs::read_to_string(&copy).unwrap().starts_with(">chr1 test\n;made by hand\nACGT"));

        store.apply_edits(&metas[0].id, insert(0, "N")).unwrap();
        let saved = store.save_file(&metas[0].file_id, None, false).unwrap();
        assert_eq!(saved[0].source.as_deref(), Some(copy.to_str().unwrap()));
        assert!(fs::read_to_string(&copy).unwrap().contains("\nNACGT"));
        assert!(!fs::read_to_string(dir.path().join("genome.fna")).unwrap().contains("NACGT"));

        let other = dir.path().join("genome.fna");
        assert_eq!(store.save_file(&metas[0].file_id, Some(&other), false).unwrap_err().kind(), io::ErrorKind::AlreadyExists);
    }

    #[test]
    fn close_refuses_unsaved_changes_unless_forced_and_removes_working_copies() {
        let (_dir, store, metas) = store_with_file();
        let file_id = &metas[0].file_id;
        store.apply_edits(&metas[0].id, insert(0, "N")).unwrap();

        assert!(store.close_file(file_id, false).is_err());
        store.close_file(file_id, true).unwrap();
        assert!(store.list().unwrap().is_empty());
        assert!(store_files(&store).is_empty(), "left {:?}", store_files(&store));
        assert!(store.apply_edits(&metas[0].id, insert(0, "N")).is_err());
        store.flush_all(); // nothing left to flush, and nothing is recreated
        assert!(store_files(&store).is_empty());
    }

    #[test]
    fn working_copies_survive_a_restart_with_their_unsaved_state() {
        let (_dir, store, metas) = store_with_file();
        store.apply_edits(&metas[1].id, insert(0, "AA")).unwrap();
        store.flush_all();

        let restarted = SeqStore::new(store.dir().to_path_buf()).unwrap();
        let listed = restarted.list().unwrap();
        assert_eq!(listed.iter().map(|m| m.modified).collect::<Vec<_>>(), [false, true]);
        assert_eq!(restarted.view(&metas[1].id).unwrap().view.read().unwrap().window(0, 10).unwrap(), "AAGGCC");
        assert!(restarted.close_file(&metas[0].file_id, false).is_err(), "still unsaved after restart");
    }

    #[test]
    fn startup_sweeps_interrupted_writes_and_orphaned_records() {
        let (dir, store, metas) = store_with_file();
        let orphan_src = dir.path().join("orphan.fa");
        fs::write(&orphan_src, ">o\nA\n").unwrap();
        let orphan = fasta::import(&orphan_src, store.dir(), "dead").unwrap().remove(0);
        fs::write(store.dir().join("abc.fa.tmp"), "half").unwrap();
        let before = store_files(&store);

        let restarted = SeqStore::new(store.dir().to_path_buf()).unwrap();
        let after = store_files(&restarted);
        assert!(!after.iter().any(|n| n.ends_with(".tmp") || n.starts_with(&orphan.id)), "{after:?}");
        assert_eq!(after.len(), before.len() - 3);
        assert_eq!(restarted.list().unwrap(), metas);
    }

    #[test]
    fn open_rejects_files_without_records() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("empty.fa");
        fs::write(&src, "\n").unwrap();
        let store = SeqStore::new(dir.path().join("tmp")).unwrap();
        assert_eq!(store.open_file(&src).unwrap_err().kind(), io::ErrorKind::InvalidData);
        assert!(store_files(&store).is_empty());
    }

    #[test]
    fn flush_persists_edits_for_a_fresh_store() {
        let (_dir, store, id) = store_with("ACGTACGT");
        store.apply_edits(&id, vec![EditOp::Insert { offset: 4, bases: "NNNN".into() }]).unwrap();
        assert!(store.flush_id(&id).unwrap());
        assert!(!store.flush_id(&id).unwrap(), "second flush has nothing to write");

        let reopened = SeqStore::new(store.dir().to_path_buf()).unwrap();
        let view = reopened.view(&id).unwrap();
        assert_eq!(view.view.read().unwrap().window(0, 100).unwrap(), "ACGTNNNNACGT");
        assert_eq!(reopened.list().unwrap()[0].length, 12);
    }

    #[test]
    fn flush_due_respects_policy() {
        let (_dir, store, id) = store_with("ACGT");
        store.apply_edits(&id, vec![EditOp::Delete { offset: 0, len: 1 }]).unwrap();
        let lazy = FlushPolicy { tick: Duration::ZERO, idle: Duration::from_secs(3600), max_pending: 10 };
        store.flush_due(&lazy);
        assert_eq!(store.view(&id).unwrap().view.read().unwrap().pending_ops(), 1);

        let eager = FlushPolicy { max_pending: 1, ..lazy };
        store.flush_due(&eager);
        assert_eq!(store.view(&id).unwrap().view.read().unwrap().pending_ops(), 0);
    }

    /// Manual timing check: `cargo test --release large_record -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn large_record_timings() {
        use std::io::Write;
        use std::time::Instant;

        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("big.fasta");
        let mut out = std::io::BufWriter::new(fs::File::create(&src).unwrap());
        writeln!(out, ">big").unwrap();
        let line: Vec<u8> = (0..70).map(|i| b"ACGTN"[i % 5]).collect();
        for _ in 0..1_500_000 {
            out.write_all(&line).unwrap();
            out.write_all(b"\n").unwrap();
        }
        drop(out);

        let store = SeqStore::new(dir.path().join("tmp")).unwrap();
        let t = Instant::now();
        let id = store.open_file(&src).unwrap().remove(0).id;
        println!("import 105 Mb: {:?}", t.elapsed());

        let handle = store.view(&id).unwrap();
        let t = Instant::now();
        for i in 0..100u64 {
            handle.view.read().unwrap().window(i * 1_000_000, 30_720).unwrap();
        }
        println!("window read (30 kb) avg: {:?}", t.elapsed() / 100);

        let t = Instant::now();
        for i in 0..1000u64 {
            store.apply_edits(&id, vec![EditOp::Insert { offset: i * 100_000, bases: "N".into() }]).unwrap();
        }
        println!("apply edit avg: {:?}", t.elapsed() / 1000);

        // :w right after editing: the snapshot still reads through 1000 unflushed pieces.
        let file_id = handle.view.read().unwrap().meta.file_id.clone();
        let t = Instant::now();
        store.save_file(&file_id, None, false).unwrap();
        println!("save (:w) with 1000 unflushed edits: {:?}", t.elapsed());

        let t = Instant::now();
        store.flush_id(&id).unwrap();
        println!("flush 1000 edits: {:?}", t.elapsed());
        assert_eq!(handle.view.read().unwrap().len(), 105_001_000);

        let t = Instant::now();
        store.save_file(&file_id, None, true).unwrap();
        println!("save (:w) after flush: {:?}", t.elapsed());
        // 105_001_000 bases at 60 per line, plus ">big\n".
        assert_eq!(fs::metadata(&src).unwrap().len(), 5 + 105_001_000 + 105_001_000_u64.div_ceil(60));
    }

    #[test]
    fn rejects_path_like_ids() {
        let (_dir, store, _id) = store_with("A");
        assert!(store.view("../secret").is_err());
    }
}
