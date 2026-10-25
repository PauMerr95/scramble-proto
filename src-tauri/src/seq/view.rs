use memchr::memmem;
use serde::{Deserialize, Serialize};

use std::fs::{self, File};
use std::io::{self, Write};
use std::path::Path;
use std::time::Instant;

use super::fasta::{self, BaseFile, CanonicalWriter, RecordMeta};
use super::{invalid_input, validate_bases};

/// Bases read per step when streaming a record (flush, search).
const STREAM_CHUNK: u64 = 1 << 20;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum EditOp {
    Insert { offset: u64, bases: String },
    Delete { offset: u64, len: u64 },
    Replace { offset: u64, bases: String },
}

#[derive(Debug, Clone, Copy, PartialEq)]
enum Source {
    Base,
    Added,
}

#[derive(Debug, Clone, Copy)]
struct Piece {
    src: Source,
    start: u64,
    len: u64,
}

/// The backend's live view of one record: the canonical file on disk plus a piece table of
/// edits that have not been written back yet. Offsets are 0-based base positions.
pub struct RecordView {
    pub meta: RecordMeta,
    base: BaseFile,
    pieces: Vec<Piece>,
    added: Vec<u8>,
    /// Ops applied since the base file was last written; replayed if they race a flush.
    log: Vec<EditOp>,
    pub last_edit: Option<Instant>,
    /// Counts every applied op, so a save can tell whether edits arrived while it was writing.
    revision: u64,
}

/// Everything a flush or export needs to write the record without holding the view lock.
pub struct Snapshot {
    base: BaseFile,
    pub header: String,
    pub comments: Vec<String>,
    pieces: Vec<Piece>,
    added: Vec<u8>,
    log_len: usize,
    pub revision: u64,
}

impl RecordView {
    pub fn open(dir: &Path, meta: RecordMeta) -> RecordView {
        let base = BaseFile::new(fasta::record_path(dir, &meta.id), &meta.header, meta.length);
        let pieces = whole_base(base.length);
        RecordView { meta, base, pieces, added: Vec::new(), log: Vec::new(), last_edit: None, revision: 0 }
    }

    pub fn len(&self) -> u64 {
        self.meta.length
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    pub fn pending_ops(&self) -> usize {
        self.log.len()
    }

    pub fn apply(&mut self, op: EditOp) -> io::Result<()> {
        match &op {
            EditOp::Insert { offset, bases } => {
                validate_bases(bases.as_bytes())?;
                if *offset > self.len() {
                    return Err(invalid_input(format!("insert at {offset} is past the end ({})", self.len())));
                }
                self.insert(*offset, bases.as_bytes());
            }
            EditOp::Delete { offset, len } => {
                self.check_range(*offset, *len)?;
                self.delete(*offset, *len);
            }
            EditOp::Replace { offset, bases } => {
                validate_bases(bases.as_bytes())?;
                self.check_range(*offset, bases.len() as u64)?;
                self.delete(*offset, bases.len() as u64);
                self.insert(*offset, bases.as_bytes());
            }
        }
        self.log.push(op);
        self.last_edit = Some(Instant::now());
        self.revision += 1;
        self.meta.modified = true;
        Ok(())
    }

    /// Called after the record was written to `source`. Stays modified if edits arrived after the
    /// snapshot that was written.
    pub fn mark_saved(&mut self, dir: &Path, revision: u64, source: &str) -> io::Result<()> {
        self.meta.modified = self.revision != revision;
        self.meta.source = Some(source.to_string());
        fasta::save_meta(dir, &self.meta)
    }

    /// Drops unwritten edits so a closed record is never flushed again.
    pub fn discard(&mut self) {
        self.log.clear();
        self.last_edit = None;
    }

    /// Bases `[start, start + len)`, clamped to the record end.
    pub fn window(&self, start: u64, len: u64) -> io::Result<String> {
        let mut out = Vec::new();
        self.read_into(start, start.saturating_add(len).min(self.len()), &mut out)?;
        String::from_utf8(out).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))
    }

    /// Case-insensitive exact match. Returns up to `limit` hit offsets at or after `from`.
    pub fn search(&self, query: &str, from: u64, limit: usize) -> io::Result<Vec<u64>> {
        let needle = query.trim().to_ascii_uppercase().into_bytes();
        validate_bases(&needle)?;
        if needle.is_empty() {
            return Ok(Vec::new());
        }
        let finder = memmem::Finder::new(&needle);
        let overlap = needle.len() as u64 - 1;
        let mut hits = Vec::new();
        let mut buf = Vec::new();
        let mut pos = from;

        while pos < self.len() && hits.len() < limit {
            buf.clear();
            self.read_into(pos, (pos + STREAM_CHUNK + overlap).min(self.len()), &mut buf)?;
            buf.make_ascii_uppercase();
            // Hits starting in the overlap belong to the next chunk.
            for idx in finder.find_iter(&buf).take_while(|i| (*i as u64) < STREAM_CHUNK) {
                hits.push(pos + idx as u64);
                if hits.len() == limit {
                    break;
                }
            }
            pos += STREAM_CHUNK;
        }
        Ok(hits)
    }

    pub fn snapshot(&self) -> Snapshot {
        Snapshot {
            base: self.base.clone(),
            header: self.meta.header.clone(),
            comments: self.meta.comments.clone(),
            pieces: self.pieces.clone(),
            added: self.added.clone(),
            log_len: self.log.len(),
            revision: self.revision,
        }
    }

    /// Swaps in the file written from `snap` and replays the ops that arrived meanwhile.
    pub fn commit(&mut self, dir: &Path, snap: Snapshot, written: &Path, new_length: u64) -> io::Result<()> {
        fs::rename(written, &self.base.path)?;
        let racing = self.log.split_off(snap.log_len);

        self.base.length = new_length;
        self.pieces = whole_base(new_length);
        self.added.clear();
        self.log.clear();
        self.meta.length = new_length;
        fasta::save_meta(dir, &self.meta)?;

        for op in racing {
            self.apply(op)?;
        }
        Ok(())
    }

    fn check_range(&self, offset: u64, len: u64) -> io::Result<()> {
        if offset.checked_add(len).is_none_or(|end| end > self.len()) {
            return Err(invalid_input(format!("range {offset}+{len} exceeds length {}", self.len())));
        }
        Ok(())
    }

    fn insert(&mut self, offset: u64, bases: &[u8]) {
        if bases.is_empty() {
            return;
        }
        let idx = self.split_at(offset);
        let start = self.added.len() as u64;
        self.added.extend_from_slice(bases);
        self.meta.length += bases.len() as u64;

        // Consecutive typing extends the previous piece instead of growing the table.
        if let Some(prev) = idx.checked_sub(1).map(|i| &mut self.pieces[i]) {
            if prev.src == Source::Added && prev.start + prev.len == start {
                prev.len += bases.len() as u64;
                return;
            }
        }
        self.pieces.insert(idx, Piece { src: Source::Added, start, len: bases.len() as u64 });
    }

    fn delete(&mut self, offset: u64, len: u64) {
        if len == 0 {
            return;
        }
        let from = self.split_at(offset);
        let to = self.split_at(offset + len);
        self.pieces.drain(from..to);
        self.meta.length -= len;
    }

    /// Splits the piece containing `offset` so a piece starts there; returns that piece's index.
    fn split_at(&mut self, offset: u64) -> usize {
        let mut pos = 0;
        for idx in 0..self.pieces.len() {
            let piece = self.pieces[idx];
            if offset == pos {
                return idx;
            }
            if offset < pos + piece.len {
                let left = offset - pos;
                self.pieces[idx].len = left;
                self.pieces.insert(idx + 1, Piece { start: piece.start + left, len: piece.len - left, ..piece });
                return idx + 1;
            }
            pos += piece.len;
        }
        self.pieces.len()
    }

    fn read_into(&self, start: u64, end: u64, out: &mut Vec<u8>) -> io::Result<()> {
        read_pieces(&self.base, &self.pieces, &self.added, start, end, out)
    }
}

impl Snapshot {
    /// Streams the snapshot into a new canonical file at `path`; returns its length.
    pub fn write_to(&self, path: &Path) -> io::Result<u64> {
        let mut writer = CanonicalWriter::create(path, &self.header)?;
        self.stream_into(&mut writer)?;
        writer.finish()
    }

    /// Pushes all bases of the snapshot into `writer`, one chunk at a time.
    pub fn stream_into<W: Write>(&self, writer: &mut CanonicalWriter<W>) -> io::Result<()> {
        let total: u64 = self.pieces.iter().map(|p| p.len).sum();
        let mut buf = Vec::new();
        let mut pos = 0;
        while pos < total {
            buf.clear();
            let end = (pos + STREAM_CHUNK).min(total);
            read_pieces(&self.base, &self.pieces, &self.added, pos, end, &mut buf)?;
            writer.push(&buf)?;
            pos = end;
        }
        Ok(())
    }
}

fn whole_base(length: u64) -> Vec<Piece> {
    if length == 0 {
        Vec::new()
    } else {
        vec![Piece { src: Source::Base, start: 0, len: length }]
    }
}

fn read_pieces(base: &BaseFile, pieces: &[Piece], added: &[u8], start: u64, end: u64, out: &mut Vec<u8>) -> io::Result<()> {
    let mut file: Option<File> = None;
    let mut pos = 0;
    for piece in pieces {
        let (p_start, p_end) = (pos, pos + piece.len);
        pos = p_end;
        if p_end <= start {
            continue;
        }
        if p_start >= end {
            break;
        }
        let from = piece.start + start.max(p_start) - p_start;
        let to = piece.start + end.min(p_end) - p_start;
        match piece.src {
            Source::Added => out.extend_from_slice(&added[from as usize..to as usize]),
            Source::Base => {
                if file.is_none() {
                    file = Some(File::open(&base.path)?);
                }
                base.read_range(file.as_mut().unwrap(), from, to, out)?;
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn setup(seq: &str) -> (tempfile::TempDir, RecordView) {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("in.fasta");
        fs::write(&src, format!(">test\n{seq}\n")).unwrap();
        let meta = fasta::import(&src, dir.path(), "f1").unwrap().remove(0);
        let view = RecordView::open(dir.path(), meta);
        (dir, view)
    }

    fn full(view: &RecordView) -> String {
        view.window(0, view.len()).unwrap()
    }

    fn ins(offset: u64, bases: &str) -> EditOp {
        EditOp::Insert { offset, bases: bases.into() }
    }

    #[test]
    fn edits_match_string_model() {
        let original: String = (0..500).map(|i| b"ACGT"[i % 4] as char).collect();
        let (_dir, mut view) = setup(&original);
        let mut model = original.clone();

        let ops = vec![
            ins(0, "NN"),
            ins(250, "RYK"),
            ins(253, "M"),
            EditOp::Delete { offset: 100, len: 50 },
            EditOp::Replace { offset: 10, bases: "WWWW".into() },
            ins(456, "acgt"), // append at the end (500 + 2 + 3 + 1 - 50)
            EditOp::Delete { offset: 0, len: 1 },
        ];
        for op in ops {
            match &op {
                EditOp::Insert { offset, bases } => model.insert_str(*offset as usize, bases),
                EditOp::Delete { offset, len } => drop(model.drain(*offset as usize..(*offset + *len) as usize)),
                EditOp::Replace { offset, bases } => {
                    model.replace_range(*offset as usize..*offset as usize + bases.len(), bases)
                }
            }
            view.apply(op).unwrap();
            assert_eq!(full(&view), model);
            assert_eq!(view.len() as usize, model.len());
        }
        assert_eq!(view.window(95, 30).unwrap(), model[95..125]);
    }

    #[test]
    fn edit_op_json_matches_frontend() {
        // Shape of `EditOp` in src/app/types/main_types.ts
        let ops: Vec<EditOp> = serde_json::from_str(
            r#"[{"kind":"insert","offset":1,"bases":"N"},{"kind":"delete","offset":2,"len":3},
                {"kind":"replace","offset":0,"bases":"AC"}]"#,
        )
        .unwrap();
        assert_eq!(ops[0], ins(1, "N"));
        assert_eq!(ops[1], EditOp::Delete { offset: 2, len: 3 });
        assert_eq!(ops[2], EditOp::Replace { offset: 0, bases: "AC".into() });
    }

    #[test]
    fn rejects_invalid_edits_without_changing_state() {
        let (_dir, mut view) = setup("ACGT");
        assert!(view.apply(ins(5, "A")).is_err());
        assert!(view.apply(ins(0, "X")).is_err());
        assert!(view.apply(EditOp::Delete { offset: 2, len: 3 }).is_err());
        assert_eq!(full(&view), "ACGT");
        assert_eq!(view.pending_ops(), 0);
        assert!(!view.meta.modified);
    }

    #[test]
    fn mark_saved_keeps_edits_that_raced_the_save() {
        let (dir, mut view) = setup("ACGT");
        view.apply(ins(0, "N")).unwrap();
        assert!(view.meta.modified);
        let snap = view.snapshot();
        view.mark_saved(dir.path(), snap.revision, "out.fa").unwrap();
        assert!(!view.meta.modified);

        let snap = view.snapshot();
        view.apply(ins(0, "N")).unwrap();
        view.mark_saved(dir.path(), snap.revision, "out.fa").unwrap();
        assert!(view.meta.modified, "edit after the snapshot is not on disk yet");
        assert_eq!(fasta::load_meta(dir.path(), &view.meta.id).unwrap().source.as_deref(), Some("out.fa"));
    }

    #[test]
    fn commit_replays_ops_that_raced_the_flush() {
        let (dir, mut view) = setup(&"ACGT".repeat(50));
        view.apply(ins(0, "NNN")).unwrap();
        let snap = view.snapshot();

        // Arrives while the snapshot is being written.
        view.apply(EditOp::Delete { offset: 3, len: 4 }).unwrap();
        let expected = full(&view);

        let tmp = dir.path().join("flush.tmp");
        let written = snap.write_to(&tmp).unwrap();
        view.commit(dir.path(), snap, &tmp, written).unwrap();

        assert_eq!(full(&view), expected);
        assert_eq!(view.pending_ops(), 1);
        let on_disk = fasta::load_meta(dir.path(), &view.meta.id).unwrap();
        assert_eq!(on_disk.length, 203);
    }

    #[test]
    fn search_finds_hits_across_pieces_case_insensitively() {
        let (_dir, mut view) = setup("aaaaGATTACAaaaa");
        view.apply(ins(15, "GATT")).unwrap();
        view.apply(ins(19, "ACA")).unwrap();
        assert_eq!(view.search("gattaca", 0, 10).unwrap(), vec![4, 15]);
        assert_eq!(view.search("GATTACA", 5, 10).unwrap(), vec![15]);
        assert_eq!(view.search("GATTACA", 0, 1).unwrap(), vec![4]);
    }
}
