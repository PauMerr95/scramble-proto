# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

`scramble-proto` is a fast-prototyping sandbox for **Scramble** (https://github.com/PauMerr95/scramble), a Tauri 2 + Angular desktop app for viewing, annotating, and editing nucleotide sequences, with access to public data through the NCBI Datasets v2 API. It started as a copy of Scramble's `main` and runs ahead of it. Features are tried here first. The ones that work out and hold up are ported back into Scramble **by hand, by the user**. Never push to or open PRs against the Scramble repo.

- Scramble's README says code, tests, commits, and PRs there are human-written. That is why AI-assisted work lives in this repo. Keep prototype code readable and close to the existing style, with no tooling-only abstractions, so it ports cleanly.
- Keep Scramble's layout (Angular in `src/`, Rust in `src-tauri/`) so a path maps 1:1 when porting.
- The proto uses its own data directory (`%LOCALAPPDATA%\ScrambleProto`, `~/.config/scramble-proto`, `~/Library/Application Support/ScrambleProto`) so it never rewrites the real app's config or store. Porting a feature back means changing `user::data::default_data_dir`.

Domain skills (load the matching one before working in that area):
- `.claude/skills/scramble-backend`: Rust/Tauri commands, the on-disk sequence store, batched background flushing, and the future codon + DataFusion layers.
- `.claude/skills/scramble-frontend`: Angular signals, the windowed CDK virtual-scroll viewer, the vim-style motion system.
- `.claude/skills/ncbi-datasets`: pulling large data from NCBI Datasets v2 into the store.
- `.claude/skills/scramble-settings`: installation-wide settings (config file, write-only API key, Settings modal).

## Commands

```sh
npm install
npm start                      # ng serve on :4200 (frontend only; every Tauri `invoke` rejects here)
npx tauri dev                  # full desktop app; runs `ng serve` as beforeDevCommand
npx tauri build                # release bundle (runs `ng build` → dist/scramble/browser)
npm run build                  # ng build (production budgets: initial 1MB error, component style 8kB error)
                               # NOTE: currently fails the initial budget (~1.9 MB), inherited from Scramble main;
                               # `ng build --configuration development` works
npx ng test --watch=false      # Vitest via @angular/build:unit-test (npm test starts watch mode)
npx ng test --watch=false --include src/app/services/sequence-viewer-service.spec.ts
npx prettier --write "src/**/*.{ts,html,scss}"   # printWidth 100, singleQuote

cd src-tauri && cargo test                       # unit tests live next to the code (#[cfg(test)])
cd src-tauri && cargo test seq::view             # filter by module path / test name
cd src-tauri && cargo test --test ipc            # end-to-end: real commands over IPC on tauri's mock runtime
cd src-tauri && cargo test --release large_record -- --ignored --nocapture   # ~100 Mb timing check
cd src-tauri && cargo clippy --all-targets
```

There is no ESLint config. Inside the app, `:e <path>` opens a FASTA/FNA file as a working copy, `:w [path]` writes it back (or saves as), `:w!` overwrites a source changed on disk, and `:q`/`:q!`/`:wq` close it. `NCBI_API_KEY` in the environment is the default user API key.

## Architecture

**Process split.** The Angular frontend runs in the Tauri webview and reaches Rust only through `invoke('<command>', {camelCaseArgs})`. Commands and managed state are registered in `with_commands` in `src-tauri/src/lib.rs` (generic over the runtime, so `src-tauri/tests/ipc.rs` runs the same handlers). Sequence commands live in `src-tauri/src/seq/commands.rs`, are `async`, and do their disk work in `spawn_blocking`. Shared state is `.manage(...)`'d: `SettingsState` (Mutex + the backend-owned config path) and `Arc<SeqStore>`. On `RunEvent::Exit` the app flushes every pending edit.

**IPC contract.** Every struct crossing IPC is `#[serde(rename_all = "camelCase")]` and mirrors a TS type. Tauri renames only command *argument names*, not fields. Each pair names the other in a comment: `SettingsInfo`/`ApiKeyStatus`/`SettingsDraft` ↔ `types/data_types.ts`, `Theme` ↔ `layout_types.ts`, `RecordMeta`/`EditOp`/`IUPAC` ↔ `types/main_types.ts`. Rust tests pin the JSON shape. Change both sides together.

**Sequence data flow.** Sequences live **on disk**, never as a whole in the webview:
1. `:e path` → `open_fasta` streams the file into the working directory `<data dir>/tmp`, one canonical FASTA per record (`<id>.fa`, 60 bases/line, so base offsets map arithmetically to bytes) plus `<id>.json` metadata and a `<file id>.file.json` manifest (source path, size/mtime stamp, record order). Non-IUPAC input is rejected and the import rolls back. Re-opening an open path returns its records.
2. The backend holds a `RecordView` per opened record: a piece table over the immutable file plus an in-memory buffer of added bases.
3. The frontend gets `RecordMeta[]` (no sequences) at bootstrap, then pulls 256-line windows (`get_window`) for whatever the virtual scroll renders, caching ≤64 chunks.
4. Edits are sent one op at a time, in order, through a promise queue (`apply_edits`) with an optimistic local length. The backend only updates the piece table.
5. A background thread (`spawn_flusher`, `FlushPolicy`: 2 s idle or 1000 pending ops) streams the snapshot to `<id>.fa.tmp` without holding the view lock, then swaps the file in and replays any ops that raced the write. This only persists the working copy.
6. `:w` → `save_file` streams every record of the file as FASTA (60/line, `;` comments) to `<target>.scramble.tmp` and renames it over the source. It refuses a source whose stamp changed, or an existing save-as target, unless forced. `:q` → `close_file` deletes the working copies; it refuses while a record is `modified` unless forced. Working copies survive restarts (session restore) and startup sweeps `*.tmp` and orphaned records.

**Frontend state** lives in `providedIn: 'root'` signal services. Components are thin. `SettingsService` (installation-wide settings: a Save-able draft for theme/work folder, a write-only API key) and `DataSessionService` (record metadata, open/save/close of files) are initialised in `provideAppInitializer`. `SequenceStoreService` wraps the sequence `invoke`s. `SequenceViewerService` handles the active record, window cache, cursor/mode, the edit queue, and search hits. `MotionService` routes every `keydown` by `LayoutService.currentFocus()`. `CmdLineService` handles `/` search, `:` ex-commands with args, and the space leader.

**NCBI.** `NCBIDataService.createUrl` builds `datasets/v2/genome/<how>/<specifier>/<what>` URLs from a `QueryPacket`. No request is made yet. Real I/O belongs in Rust (see the skill).

## Target backend direction

- **Now:** uncompressed canonical FASTA + piece table (`src-tauri/src/seq/`).
- **Later:** [codon](https://github.com/PauMerr95/codon) (`refactor` branch), a C++ library that packs bases into bytes with orientation markers. The refactor adds support for all IUPAC codes, so the store's IUPAC validation stays the contract. Bind it through FFI behind the same `RecordView`/store interface.
- **Storage/query:** Apache DataFusion (`datafusion` crate, Arrow/Parquet) for reports, annotations, and record metadata.

## Conventions

- Angular: standalone components, `inject()`, `input()`/`computed()`/`signal()`, `@if`/`@for` control flow (but `*cdkVirtualFor` inside the viewport), SCSS, selector prefix `app`, no `.component` file suffix.
- Commits use conventional style with a scope: `feat(seq-store): …`, `fix(viewer): …`.
- Specs sit next to sources and use Vitest globals with `TestBed`. Backend-facing services are replaced in specs by fakes such as `services/fake-sequence-store.mock.ts`, because `invoke` doesn't exist under Vitest. Put spec-only helpers in `*.mock.ts`: the app build excludes them and the spec build includes them.
