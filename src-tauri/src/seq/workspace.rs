//! Files opened for editing.
//!
//! `:e path` copies every record of a FASTA/FNA file into the working directory (`<data dir>/tmp`)
//! and writes a manifest (`<file id>.file.json`) remembering where the records came from. The
//! working copies survive restarts like an editor session until the file is closed. Saving
//! streams the records back out as FASTA, replacing the source atomically.
//!
//! Interim layer: once codon stores the records, only the export side here stays.

use serde::{Deserialize, Serialize};

use std::fs::{self, File};
use std::io::{self, BufWriter};
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use super::fasta::CanonicalWriter;
use super::view::Snapshot;

/// Size and modification time of a source file, to notice changes made by other programs.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileStamp {
    pub len: u64,
    pub modified_ns: u64,
}

impl FileStamp {
    pub fn of(path: &Path) -> io::Result<FileStamp> {
        let meta = fs::metadata(path)?;
        let modified_ns = meta
            .modified()?
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos() as u64)
            .unwrap_or(0);
        Ok(FileStamp { len: meta.len(), modified_ns })
    }
}

/// Manifest of one opened file. Never crosses IPC; records carry `file_id` instead.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenFile {
    pub id: String,
    /// Absolute path that `:w` writes back to.
    pub path: String,
    /// State of `path` when it was opened or last saved.
    pub stamp: FileStamp,
    /// Record ids in file order.
    pub records: Vec<String>,
}

pub fn manifest_path(dir: &Path, id: &str) -> PathBuf {
    dir.join(format!("{id}.file.json"))
}

pub fn save_manifest(dir: &Path, file: &OpenFile) -> io::Result<()> {
    let raw = serde_json::to_vec_pretty(file).map_err(io::Error::other)?;
    let tmp = dir.join(format!("{}.file.json.tmp", file.id));
    fs::write(&tmp, raw)?;
    fs::rename(tmp, manifest_path(dir, &file.id))
}

pub fn load_manifest(dir: &Path, id: &str) -> io::Result<OpenFile> {
    let raw = fs::read(manifest_path(dir, id))?;
    serde_json::from_slice(&raw).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))
}

/// Every opened file, in open order (ids start with a timestamp).
pub fn list_manifests(dir: &Path) -> io::Result<Vec<OpenFile>> {
    let mut files = Vec::new();
    for entry in fs::read_dir(dir)? {
        let name = entry?.file_name();
        let Some(id) = name.to_str().and_then(|n| n.strip_suffix(".file.json")) else { continue };
        if super::fasta::is_valid_record_id(id) {
            files.push(load_manifest(dir, id)?);
        }
    }
    files.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(files)
}

/// True if both paths name the same file. Resolves case and symlinks where the OS does
/// (`canonicalize` needs both to exist), otherwise compares the paths as given.
pub fn same_file(a: &Path, b: &Path) -> bool {
    match (fs::canonicalize(a), fs::canonicalize(b)) {
        (Ok(a), Ok(b)) => a == b,
        _ => a == b,
    }
}

/// Where an export is written before it replaces `target`: next to it, so the rename stays on
/// one volume and is atomic on every OS.
pub fn export_tmp_path(target: &Path) -> PathBuf {
    let mut name = target.file_name().unwrap_or_default().to_os_string();
    name.push(".scramble.tmp");
    target.with_file_name(name)
}

/// Writes the records as one multi-FASTA file (header, `;` comments, `LINE_BASES` per line) and
/// syncs it to disk.
pub fn write_fasta(path: &Path, records: &[Snapshot]) -> io::Result<()> {
    let mut out = BufWriter::new(File::create(path)?);
    for snap in records {
        let mut writer = CanonicalWriter::start(&mut out, &snap.header, &snap.comments)?;
        snap.stream_into(&mut writer)?;
        writer.finish()?;
    }
    out.into_inner().map_err(|e| e.into_error())?.sync_all()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifests_roundtrip_and_ignore_other_files() {
        let dir = tempfile::tempdir().unwrap();
        let file = OpenFile {
            id: "f1".into(),
            path: "/data/x.fna".into(),
            stamp: FileStamp { len: 4, modified_ns: 1 },
            records: vec!["a".into(), "b".into()],
        };
        save_manifest(dir.path(), &file).unwrap();
        fs::write(dir.path().join("a.json"), "{}").unwrap();
        fs::write(dir.path().join("not-hex.file.json"), "{}").unwrap();

        assert_eq!(load_manifest(dir.path(), "f1").unwrap(), file);
        assert_eq!(list_manifests(dir.path()).unwrap(), vec![file]);
    }

    #[test]
    fn stamp_changes_when_the_file_does() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("x.fa");
        fs::write(&path, ">h\nACGT\n").unwrap();
        let before = FileStamp::of(&path).unwrap();
        fs::write(&path, ">h\nACGTA\n").unwrap();
        assert_ne!(FileStamp::of(&path).unwrap(), before);
    }

    #[test]
    fn export_tmp_sits_next_to_target() {
        let target = Path::new("some").join("dir").join("genome.fna");
        assert_eq!(export_tmp_path(&target), Path::new("some").join("dir").join("genome.fna.scramble.tmp"));
    }
}
