---
name: scramble-backend
description: Rust/Tauri backend for scramble-proto — Tauri commands and IPC contracts, managed state, the on-disk sequence store (canonical FASTA + piece-table views + batched background flushing), and the planned codon (C++ FFI) + DataFusion layers. Use when touching src-tauri/, adding invoke commands, or changing how sequence data is stored, edited, or served.
---

# Scramble backend (src-tauri)

## Layout

- `main.rs`: `#[tokio::main]`, loads `UserInfo` from `<data dir>/.config.toml`, and calls `app_lib::run`.
- `lib.rs`: builder, `.manage(UserState)`, `.manage(Arc<SeqStore>)`, starts the flusher thread, user commands, and flush-all on `RunEvent::Exit`.
- `user/data.rs`: `UserInfo`/`Theme`/`Avatar` (mirror the TS types) and `default_data_dir` (proto-specific dirs).
- `seq.rs`: IUPAC set and validation. `seq/fasta.rs`: canonical files, `RecordMeta`, streaming import. `seq/view.rs`: `RecordView` piece table, `EditOp`, window/search, snapshot/commit. `seq/store.rs`: `SeqStore`, `FlushPolicy`, `spawn_flusher`. `seq/commands.rs`: the `invoke` surface.

## IPC rules

- Structs crossing IPC: `#[serde(rename_all = "camelCase")]`, with a comment naming the TS mirror, and a Rust test that pins the JSON (see `ipc_json_matches_frontend_user_info`, `edit_op_json_matches_frontend`). `Option<T>` ↔ `T | null`.
- Disk/CPU work: `async` command + `spawn_blocking` (the `blocking()` helper in `seq/commands.rs`). Commands that borrow `State` must return `Result`.
- Never return a whole sequence. Windows (`get_window`) and hit offsets (`search_sequence`, capped by `limit`) only.
- Errors: `io::Result` inside `seq`, mapped to `String` at the command boundary. Use `invalid_input(..)` for caller mistakes.
- Long jobs (import, NCBI downloads) should report progress through a `tauri::ipc::Channel<T>` argument. Import doesn't yet.
- New plugins need permissions in `capabilities/default.json`.

## Sequence store invariants

- Canonical record file: `>header\n` followed by bases, exactly `LINE_BASES` (80) per line, `\n` endings. `BaseFile::byte_pos` relies on this, so anything that writes `<id>.fa` must go through `CanonicalWriter`. Comments live only in `<id>.json`.
- Record ids are lowercase hex (timestamp + counter) and are validated by `is_valid_record_id` before touching paths (they come from IPC).
- Stored bases are IUPAC (`ACGTURYSWKMBDHVN-.`, any case; lowercase = soft-masking is preserved). Import and edits reject anything else.
- `RecordView.meta.length` is the logical (edited) length. The base file's length changes only on commit.
- Flush protocol (`SeqStore::flush`): take the per-record `flush_lock`, snapshot under a read lock, write `<id>.fa.tmp` with **no** view lock held, then under the write lock call `commit`. Commit renames, resets the pieces, and replays `log[snapshot.log_len..]`. Edits and window reads keep working during the write. Only one flush per record runs at a time.
- On Windows a rename fails if the target is open. Window reads open the file per call and close it before releasing the read lock, so commit (write lock) never races an open handle. Keep it that way.
- Measured on a dev laptop (`large_record_timings`, release): 105 Mb import ≈1.5 s, 30 kb window ≈0.13 ms, edit ≈1.5 µs, flush of 1000 edits ≈0.4 s.

Known prototype limits: search holds the record's read lock for the whole scan (it blocks edits on huge records), and `apply_edits` isn't atomic across a batch (an invalid op leaves the earlier ones applied). There is no undo, no FASTA export of multiple records, and no delete-record command yet.

## Future: codon + DataFusion

- **codon** (https://github.com/PauMerr95/codon, `refactor` branch): C++ (CMake). A `Codon` is 1 byte holding 1–3 bases behind a 2-bit orientation marker, so a bitwise NOT gives the reverse complement. A `Seq` holds codons and is addressed by `locator`s. The refactor adds **all IUPAC codes**, so the store's IUPAC contract carries over unchanged.
  - Integration: `cmake` crate in `build.rs` + `cxx` (or an `extern "C"` shim + bindgen). Catch C++ exceptions in the shim, because they must not cross FFI.
  - Bytes per base vary, so canonical-FASTA arithmetic offsets go away. Keep a checkpoint index (base offset every N codons) so window reads stay O(window).
  - Replace `BaseFile` + `CanonicalWriter` behind `RecordView`/`SeqStore`. The piece table, flush protocol, and commands shouldn't need to change.
- **DataFusion** (`datafusion` crate): one `SessionContext` in managed state, with Parquet tables for NCBI reports (JSON Lines → Arrow), annotations (GFF3 → features), and record metadata. Feature overlap for a viewer window becomes a range query.
