use serde::{Deserialize, Serialize};

use std::fs::{self, File};
use std::io::{self, BufRead, BufReader, BufWriter, Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use super::validate_bases;

/// Bases per line in canonical record files. Because every line but the last has exactly this
/// many bases followed by '\n', a base offset maps to a byte offset arithmetically (like .fai).
pub const LINE_BASES: u64 = 80;
const LINE_BYTES: u64 = LINE_BASES + 1;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordMeta {
    pub id: String,
    pub header: String,
    pub comments: Vec<String>,
    pub length: u64,
    pub source: Option<String>,
}

/// Location of a canonical record file and how to address bases in it.
#[derive(Debug, Clone)]
pub struct BaseFile {
    pub path: PathBuf,
    pub seq_offset: u64,
    pub length: u64,
}

impl BaseFile {
    pub fn new(path: PathBuf, header: &str, length: u64) -> BaseFile {
        // '>' + header + '\n'
        BaseFile { path, seq_offset: header.len() as u64 + 2, length }
    }

    fn byte_pos(&self, base: u64) -> u64 {
        self.seq_offset + (base / LINE_BASES) * LINE_BYTES + base % LINE_BASES
    }

    /// Appends bases `[start, end)` to `out`, stripping line breaks.
    pub fn read_range(&self, file: &mut File, start: u64, end: u64, out: &mut Vec<u8>) -> io::Result<()> {
        if start >= end {
            return Ok(());
        }
        let from = self.byte_pos(start);
        let to = self.byte_pos(end - 1) + 1;
        let mut buf = vec![0u8; (to - from) as usize];
        file.seek(SeekFrom::Start(from))?;
        file.read_exact(&mut buf)?;
        out.extend(buf.into_iter().filter(|b| *b != b'\n'));
        Ok(())
    }
}

/// Streams bases into a canonical record file, wrapping lines at `LINE_BASES`.
pub struct CanonicalWriter {
    out: BufWriter<File>,
    col: u64,
    pub length: u64,
}

impl CanonicalWriter {
    pub fn create(path: &Path, header: &str) -> io::Result<CanonicalWriter> {
        let mut out = BufWriter::new(File::create(path)?);
        writeln!(out, ">{header}")?;
        Ok(CanonicalWriter { out, col: 0, length: 0 })
    }

    pub fn push(&mut self, mut bases: &[u8]) -> io::Result<()> {
        while !bases.is_empty() {
            let take = ((LINE_BASES - self.col) as usize).min(bases.len());
            self.out.write_all(&bases[..take])?;
            self.col += take as u64;
            self.length += take as u64;
            bases = &bases[take..];
            if self.col == LINE_BASES {
                self.out.write_all(b"\n")?;
                self.col = 0;
            }
        }
        Ok(())
    }

    pub fn finish(mut self) -> io::Result<u64> {
        if self.col > 0 {
            self.out.write_all(b"\n")?;
        }
        self.out.flush()?;
        Ok(self.length)
    }
}

pub fn record_path(dir: &Path, id: &str) -> PathBuf {
    dir.join(format!("{id}.fa"))
}
pub fn meta_path(dir: &Path, id: &str) -> PathBuf {
    dir.join(format!("{id}.json"))
}
pub fn tmp_path(dir: &Path, id: &str) -> PathBuf {
    dir.join(format!("{id}.fa.tmp"))
}

pub fn save_meta(dir: &Path, meta: &RecordMeta) -> io::Result<()> {
    let raw = serde_json::to_vec_pretty(meta).map_err(io::Error::other)?;
    let tmp = dir.join(format!("{}.json.tmp", meta.id));
    fs::write(&tmp, raw)?;
    fs::rename(tmp, meta_path(dir, &meta.id))
}

pub fn load_meta(dir: &Path, id: &str) -> io::Result<RecordMeta> {
    let raw = fs::read(meta_path(dir, id))?;
    serde_json::from_slice(&raw).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))
}

/// Ids are lowercase hex so they are safe to use as file names.
pub fn new_record_id() -> String {
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    format!("{:x}{:04x}", nanos, COUNTER.fetch_add(1, Ordering::Relaxed) & 0xffff)
}

pub fn is_valid_record_id(id: &str) -> bool {
    !id.is_empty() && id.bytes().all(|b| b.is_ascii_hexdigit())
}

struct PendingRecord {
    meta: RecordMeta,
    writer: CanonicalWriter,
}

impl PendingRecord {
    fn start(dir: &Path, header: String, source: &Path) -> io::Result<PendingRecord> {
        let id = new_record_id();
        let writer = CanonicalWriter::create(&tmp_path(dir, &id), &header)?;
        let meta = RecordMeta {
            id,
            header,
            comments: Vec::new(),
            length: 0,
            source: Some(source.to_string_lossy().into_owned()),
        };
        Ok(PendingRecord { meta, writer })
    }

    fn finish(mut self, dir: &Path) -> io::Result<RecordMeta> {
        self.meta.length = self.writer.finish()?;
        fs::rename(tmp_path(dir, &self.meta.id), record_path(dir, &self.meta.id))?;
        save_meta(dir, &self.meta)?;
        Ok(self.meta)
    }
}

/// Streams a (multi-)FASTA file into the store, one canonical file per record. Never holds more
/// than one input line in memory. All-or-nothing: on error every record written so far is removed.
pub fn import(source: &Path, dir: &Path) -> io::Result<Vec<RecordMeta>> {
    let mut done: Vec<RecordMeta> = Vec::new();
    let mut current: Option<PendingRecord> = None;

    let result = import_into(source, dir, &mut done, &mut current);
    if result.is_err() {
        if let Some(pending) = current {
            let _ = fs::remove_file(tmp_path(dir, &pending.meta.id));
        }
        for meta in &done {
            let _ = fs::remove_file(record_path(dir, &meta.id));
            let _ = fs::remove_file(meta_path(dir, &meta.id));
        }
    }
    result.map(|_| done)
}

fn import_into(
    source: &Path,
    dir: &Path,
    done: &mut Vec<RecordMeta>,
    current: &mut Option<PendingRecord>,
) -> io::Result<()> {
    let mut reader = BufReader::new(File::open(source)?);
    let mut line = Vec::new();
    let mut line_no = 0u64;

    loop {
        line.clear();
        if reader.read_until(b'\n', &mut line)? == 0 {
            break;
        }
        line_no += 1;
        let text = line.trim_ascii();

        if let Some(header) = text.strip_prefix(b">") {
            if let Some(pending) = current.take() {
                done.push(pending.finish(dir)?);
            }
            let header = String::from_utf8_lossy(header).trim().to_string();
            *current = Some(PendingRecord::start(dir, header, source)?);
        } else if let Some(comment) = text.strip_prefix(b";") {
            if let Some(pending) = current.as_mut() {
                pending.meta.comments.push(String::from_utf8_lossy(comment).trim().to_string());
            }
        } else if !text.is_empty() {
            if current.is_none() {
                // Headerless input: name the record after the file.
                let stem = source.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
                *current = Some(PendingRecord::start(dir, stem, source)?);
            }
            let bases: Vec<u8> = text.iter().copied().filter(|b| !b.is_ascii_whitespace()).collect();
            validate_bases(&bases)
                .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, format!("line {line_no}: {e}")))?;
            current.as_mut().unwrap().writer.push(&bases)?;
        }
    }
    if let Some(pending) = current.take() {
        done.push(pending.finish(dir)?);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn import_splits_records_and_wraps_lines() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("in.fasta");
        let seq: String = "ACGTN".repeat(40); // 200 bases, ragged input lines below
        fs::write(&src, format!(">rec one\n;a comment\n{}\n{}\n>rec two\nacgt\n", &seq[..130], &seq[130..])).unwrap();

        let metas = import(&src, dir.path()).unwrap();
        assert_eq!(metas.len(), 2);
        assert_eq!(metas[0].header, "rec one");
        assert_eq!(metas[0].comments, vec!["a comment"]);
        assert_eq!(metas[0].length, 200);
        assert_eq!(metas[1].length, 4);

        let raw = fs::read_to_string(record_path(dir.path(), &metas[0].id)).unwrap();
        let lines: Vec<&str> = raw.lines().collect();
        assert_eq!(lines, vec![">rec one", &seq[..80], &seq[80..160], &seq[160..]]);
        assert_eq!(load_meta(dir.path(), &metas[1].id).unwrap(), metas[1]);
    }

    #[test]
    fn read_range_matches_slices() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("in.fasta");
        let seq: String = (0..1000).map(|i| b"ACGT"[i % 4] as char).collect();
        fs::write(&src, format!(">h\n{seq}\n")).unwrap();
        let meta = import(&src, dir.path()).unwrap().remove(0);
        let base = BaseFile::new(record_path(dir.path(), &meta.id), &meta.header, meta.length);
        let mut file = File::open(&base.path).unwrap();

        for (start, end) in [(0, 1), (0, 80), (79, 81), (155, 401), (999, 1000), (0, 1000)] {
            let mut out = Vec::new();
            base.read_range(&mut file, start, end, &mut out).unwrap();
            assert_eq!(out, seq.as_bytes()[start as usize..end as usize], "range {start}..{end}");
        }
    }

    #[test]
    fn import_rejects_non_iupac_and_cleans_up() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("in.fasta");
        fs::write(&src, ">ok\nACGT\n>bad\nACGTXZ\n").unwrap();

        let err = import(&src, dir.path()).unwrap_err();
        assert_eq!(err.kind(), io::ErrorKind::InvalidData);
        let leftovers: Vec<_> = fs::read_dir(dir.path()).unwrap().filter_map(|e| e.ok())
            .filter(|e| e.file_name() != "in.fasta").collect();
        assert!(leftovers.is_empty(), "left files behind: {leftovers:?}");
    }
}
