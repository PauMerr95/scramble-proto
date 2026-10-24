//! On-disk sequence storage.
//!
//! Records live in the store directory as canonical FASTA files (`<id>.fa`, one record each,
//! fixed line width) plus a JSON sidecar (`<id>.json`) holding the metadata. The backend keeps a
//! `RecordView` per opened record: a piece table over the immutable file that collects edits in
//! memory. A background thread writes the collected edits back to disk in batches.
//!
//! This is the interim, uncompressed layer until codon is ready.

pub mod commands;
pub mod fasta;
pub mod store;
pub mod view;

use std::io;

/// IUPAC nucleotide codes (incl. U for RNA) plus gap symbols. Matched case-insensitively so
/// soft-masked (lowercase) regions are preserved as-is.
pub const IUPAC: &[u8] = b"ACGTURYSWKMBDHVN-.";

pub fn is_iupac(base: u8) -> bool {
    IUPAC.contains(&base.to_ascii_uppercase())
}

pub fn validate_bases(bases: &[u8]) -> io::Result<()> {
    match bases.iter().position(|b| !is_iupac(*b)) {
        None => Ok(()),
        Some(idx) => Err(invalid_input(format!(
            "'{}' at position {} is not an IUPAC nucleotide code",
            bases[idx] as char, idx
        ))),
    }
}

pub fn invalid_input(msg: impl Into<String>) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidInput, msg.into())
}
