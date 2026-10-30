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
- Backend-backed init goes into `provideAppInitializer` in `app.config.ts` (currently `SettingsService.init` + `DataSessionService.init`).
- All Tauri calls go through a wrapper service (`SequenceStoreService`, `SettingsService`). Specs swap it for a fake (`services/fake-sequence-store.mock.ts`) through `{ provide: SequenceStoreService, useValue: fake }`, or pin the `invoke` calls with `mockIPC` from `@tauri-apps/api/mocks`.

## Panes

- `PaneService` (root) owns `columns: Pane[][]`: at most two columns of at most two panes. Slots are geometric (TL=1, TR=2, BL=3, BR=4); a pane alone in a column sits in its top slot and spans it. Removal compacts: the lone pane moves up, an emptied left column is replaced by the right one.
- `MainPane` renders all panes as one flat `@for` tracked by pane id, absolutely placed from `colSplit`/`rowSplits` (`cells`/`dividers` computeds), so removing a pane never recreates the others. Don't nest panes in per-column `@for`s again.
- `Pane` signals are read-only for components (`PaneState` inside PaneService holds the writable ones).
- Each `Pane` has its own `SequenceViewerService` from `createEnvironmentInjector`; `remove()` destroys that injector (and the viewer's effects). Never inject `SequenceViewerService` from root: use `PaneService.activeViewer()` (MotionService/CmdLineService/Statusbar expose it as a `sqv`/`svc` getter).
- Newly opened files go to the active pane (PaneService effect); a viewer only moves on when its own record closes. Viewers track their record by id.
- `EditQueueService` (root) is the one ordered edit queue for all panes; `onApplied` listeners invalidate every viewer showing the record.
- Keys: `Ctrl+w v|s` split (prefix, works in every mode), `Alt+h/j/k/l` (by `e.code`) move; `:pd`, `:pq`, `:pq!`, `:toggleAnnotation`, leader `a`.
- AnnotationOverlay (placeholder) is projected into the viewer's `.viewport-area`, covers half the pane and flips sides via `overlaySideFor` when the cursor gets behind it. The viewer reports where it drew the cursor (`cursorPlace` output, `afterEveryRender`) to `PaneService.reportCursor`; its height also decides whether Alt+h/l out of a full-height pane enters the top or bottom pane of the other column (compared with that column's divider). Lines scroll horizontally in narrow panes; the line-number gutter is sticky.

## Windowed sequence viewer

`SequenceViewerService` never holds a whole sequence:
- `activeRecord()` is `RecordMeta`. `length()`, `totalLines()`, and `lineIndices()` derive from it, and `lineIndices` is the `*cdkVirtualFor` source.
- `lineAt(i)` reads from a chunk cache (`CHUNK_LINES` = 256 lines per `get_window`, ≤ `MAX_CACHED_CHUNKS`, evicted by distance from the viewport). It returns `null` while loading, and `SequenceLine` renders a placeholder.
- The viewer component feeds `renderedRangeStream` into `setVisibleLines()`, which loads the visible chunks ±1.
- A `generation` counter makes chunk fetches cancel-safe. A response for an old generation or a different record is dropped. `invalidateFrom(offset)` re-stamps chunks before the edit as fresh and lets the rest show stale text until the refetch lands.
- Edits: `edit()` hands the op to `EditQueueService.enqueue`, which patches the record length optimistically (cursor maths stays synchronous), then chains `applyEdits` onto its queue. That keeps ops in order even if IPC calls resolve out of order. The backend length is trusted only when no other edit is pending. The `.catch` must never rethrow, because a rejected queue drops every later edit.
- Cursor, selection, and search hits are absolute base offsets (`row = floor(offset / LINE_WIDTH)`). Visual selection is inclusive on both ends.
- Must stay in sync: `ITEM_SIZE_PX` (22) ↔ `.line { height }` in `sequence-line.scss`, and `LINE_WIDTH` (120) ↔ all row/col maths.
- Don't put `@for` inside `cdk-virtual-scroll-viewport`, because it renders every row. Use `*cdkVirtualFor` with `trackBy`. Keep the viewport outside any `@if` so its `@ViewChild` exists when the first record arrives.
- Browser element height caps at roughly 16–33 M px. At 22 px × 120 bp that is ≈ 120–180 Mb per record. Larger records need scaled scroll mapping or a position-jump scrollbar (not done yet).

## Keyboard / focus model

- `App` sends every `keydown` to `MotionService.handleKeyDown`, which switches on `LayoutService.currentFocus()`.
- Main pane is a modal editor. `Normal`: h/j/k/l, w/b, 0/^/$, g/G, i/a/r/v/x, n/N for search hits. Plus `Insert`, `Replace`, and `Visual`. `Esc` returns to Normal. Insert/replace accept `IUPAC_CODES` only (it mirrors the backend set).
- `:` and `/` open the centred `app-cmd-modal` (`components/pop-up/cmd-modal`). Space starts the leader with no overlay, because it is a shortcut prefix. `CmdLineService.open()` remembers the previous focus and switches it to `CmdModal`. `close()` restores it. In that focus, `MotionService` only intercepts Esc/Enter/↑↓/Tab (leader: single keys) and must let every other key reach the `<input>`: a blanket `preventDefault` there is what broke the old command line. Results go to `LayoutService.notify`, not to the UI. Ex-commands are `{usage, description, run}` entries, and the hint list is built from those same entries.
- `/` search (backend, ≤ `SEARCH_LIMIT` hits, jumps to the first hit at/after the cursor), `:` ex-commands (`executeCmds: Record<string, ExCommand>`, args after the first word, e.g. `:e path`, `:w [path]`, `:w!`, `:q`, `:q!`, `:wq`; names include the `!`), and space leader (5 s timeout, `leaderCmds`).
- There is no side pane. The navbar panels (Settings, Files, Query) open in the one centred `app-modal` (`components/pop-up/modal`), which renders the top of a modal stack in `LayoutService` through a `modal/<name>` child route (`modals` in `types/layout_types.ts` ↔ `app.routes.ts`). `toggleModal(panel)` (navbar, leader `s`/`f`/`q`) replaces the stack or closes it; `openModal` pushes a sub-modal; `closeModal` pops back. In `Modal` focus, Esc goes through `MotionService` → `handleEsc`: an open drop down closes first, otherwise the top modal pops. Leaving Settings with unsaved changes (Esc, backdrop, navbar) only warns the first time; the second try discards the draft.
- Modals navigate with 2D move grids (`move-grids/mv-grids-modals.ts`) of `SelectableLocation` ids (`types/layout_types.ts`, a strict union: open drop downs inject `DropDownOptionLocation` ids), loaded by a panel's effect while it is the `activeModal()`. Opening/closing a modal unloads the grid. A new focusable widget needs an id in those unions and a slot in the grid.
- `loadGrid` and the move methods replace the selector with a new object on every change and run `untracked`, so an effect may react to `currentlyTargeted()` and still call `loadGrid` without looping.
- Layered grid (Settings): `loadLayeredGrid(base, sub, anchor)` keeps a fixed base (section list + Save) and a sub-grid merged to its right by row index; `setSubGrid` swaps it with a rebuild, no splicing. Movement: j/k stay inside their layer, l from the base enters the sub-grid at its top, h from its first column returns to `anchor`. While a drop down is open, plain movement applies (its injected rows shift the indices).

## Testing

- `npx ng test --watch=false [--include <spec>]`. Vitest globals; use `TestBed.tick()` to run root effects (e.g. record auto-select) and `vi.waitFor` for the async window/edit pipeline.
- Test windowing and edit logic at the service level against the fake store. jsdom doesn't lay out the virtual-scroll viewport.
