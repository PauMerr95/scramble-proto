---
name: scramble-frontend
description: Angular frontend for scramble-proto — signal-based services, the windowed CDK virtual-scroll sequence viewer, the optimistic in-order edit queue, the vim-style motion/focus system and command line. Use when touching src/ (components, services, types, specs).
---

# Scramble frontend (src/)

Much of the UI will change. These parts stay:
- **Modern Angular with signals as the main state mechanism**: standalone components, `inject()`, `input()`, `signal`/`computed`/`effect`, `@if`/`@for`. RxJS only at boundaries (e.g. `viewport.renderedRangeStream` + `takeUntilDestroyed`).
- **`@angular/cdk/scrolling` virtual scroll for the sequence viewer.**

## State and services

- Root services own state, and components read signals. Expose state read-only (`asReadonly()`/`computed`) and mutate through methods (`DataSessionService.records` / `patchRecord`).
- Backend-backed init goes into `provideAppInitializer` in `app.config.ts` (currently `UserDataService.init` + `DataSessionService.init`).
- All Tauri calls go through a wrapper service (`SequenceStoreService`, `UserDataService`). Specs swap it for a fake (`services/fake-sequence-store.mock.ts`) through `{ provide: SequenceStoreService, useValue: fake }`.

## Windowed sequence viewer

`SequenceViewerService` never holds a whole sequence:
- `activeRecord()` is `RecordMeta`. `length()`, `totalLines()`, and `lineIndices()` derive from it, and `lineIndices` is the `*cdkVirtualFor` source.
- `lineAt(i)` reads from a chunk cache (`CHUNK_LINES` = 256 lines per `get_window`, ≤ `MAX_CACHED_CHUNKS`, evicted by distance from the viewport). It returns `null` while loading, and `SequenceLine` renders a placeholder.
- The viewer component feeds `renderedRangeStream` into `setVisibleLines()`, which loads the visible chunks ±1.
- A `generation` counter makes chunk fetches cancel-safe. A response for an old generation or a different record is dropped. `invalidateFrom(offset)` re-stamps chunks before the edit as fresh and lets the rest show stale text until the refetch lands.
- Edits: `edit()` patches the record length optimistically (cursor maths stays synchronous), then chains `applyEdits` onto `editQueue`. That keeps ops in order even if IPC calls resolve out of order. The backend length is trusted only when no other edit is pending. The `.catch` must never rethrow, because a rejected queue drops every later edit.
- Cursor, selection, and search hits are absolute base offsets (`row = floor(offset / LINE_WIDTH)`). Visual selection is inclusive on both ends.
- Must stay in sync: `ITEM_SIZE_PX` (22) ↔ `.line { height }` in `sequence-line.scss`, and `LINE_WIDTH` (120) ↔ all row/col maths.
- Don't put `@for` inside `cdk-virtual-scroll-viewport`, because it renders every row. Use `*cdkVirtualFor` with `trackBy`. Keep the viewport outside any `@if` so its `@ViewChild` exists when the first record arrives.
- Browser element height caps at roughly 16–33 M px. At 22 px × 120 bp that is ≈ 120–180 Mb per record. Larger records need scaled scroll mapping or a position-jump scrollbar (not done yet).

## Keyboard / focus model

- `App` sends every `keydown` to `MotionService.handleKeyDown`, which switches on `LayoutService.currentFocus()`.
- Main pane is a modal editor. `Normal`: h/j/k/l, w/b, 0/^/$, g/G, i/a/r/v/x, n/N for search hits. Plus `Insert`, `Replace`, and `Visual`. `Esc` returns to Normal. Insert/replace accept `IUPAC_CODES` only (it mirrors the backend set).
- `:` and `/` open the centred `app-cmd-modal` (`components/pop-up/cmd-modal`). Space starts the leader with no overlay, because it is a shortcut prefix. `CmdLineService.open()` remembers the previous focus and switches it to `CmdModal`. `close()` restores it. In that focus, `MotionService` only intercepts Esc/Enter/↑↓/Tab (leader: single keys) and must let every other key reach the `<input>`: a blanket `preventDefault` there is what broke the old command line. Results go to `LayoutService.notify`, not to the UI. Ex-commands are `{usage, description, run}` entries, and the hint list is built from those same entries.
- `/` search (backend, ≤ `SEARCH_LIMIT` hits, jumps to the first hit at/after the cursor), `:` ex-commands (`executeCmds: Record<string, ExCommand>`, args after the first word, e.g. `:e path`, `:w [path]`, `:w!`, `:q`, `:q!`, `:wq`; names include the `!`), and space leader (5 s timeout, `leaderCmds`).
- Side pane and modals navigate with 2D move grids (`move-grids/*.ts`) of `SelectableLocation` ids. A new focusable widget needs an id in those unions and a slot in the grid.

## Testing

- `npx ng test --watch=false [--include <spec>]`. Vitest globals; use `TestBed.tick()` to run root effects (e.g. record auto-select) and `vi.waitFor` for the async window/edit pipeline.
- Test windowing and edit logic at the service level against the fake store. jsdom doesn't lay out the virtual-scroll viewport.
