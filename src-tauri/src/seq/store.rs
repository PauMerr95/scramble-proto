use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, RwLock};
use std::thread;
use std::time::Duration;

use super::fasta::{self, RecordMeta};
use super::invalid_input;
use super::view::{EditOp, RecordView};

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
}

impl SeqStore {
    pub fn new(dir: PathBuf) -> io::Result<SeqStore> {
        fs::create_dir_all(&dir)?;
        Ok(SeqStore { dir, views: Mutex::new(HashMap::new()) })
    }

    pub fn dir(&self) -> &Path {
        &self.dir
    }

    pub fn import(&self, source: &Path) -> io::Result<Vec<RecordMeta>> {
        fasta::import(source, &self.dir)
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
        let store = SeqStore::new(dir.path().join("store")).unwrap();
        let id = store.import(&src).unwrap().remove(0).id;
        (dir, store, id)
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

        let store = SeqStore::new(dir.path().join("store")).unwrap();
        let t = Instant::now();
        let id = store.import(&src).unwrap().remove(0).id;
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

        let t = Instant::now();
        store.flush_id(&id).unwrap();
        println!("flush 1000 edits: {:?}", t.elapsed());
        assert_eq!(handle.view.read().unwrap().len(), 105_001_000);
    }

    #[test]
    fn rejects_path_like_ids() {
        let (_dir, store, _id) = store_with("A");
        assert!(store.view("../secret").is_err());
    }
}
