# IMPLEMENT

## Rules

- This is a todolist for implementation of upcoming features.
- Before implementation the addition or deprecation of features needs to be planned in more
  detail. This document just holds an overview.

## Frontend

1. [ ] Deprecation of sidebar -> switch to modal only.
       Known discrepancies (likely gone after the refactor, but keep in mind):
       - `SidePane`'s `switchMode` output is never emitted, so `App.switchMode`/`activeMode` and
         the `(switchMode)` binding in `app.html` are dead code.
       - The fake `LayoutService` in `motion-service.spec.ts` defines `handleEscape`, but the real
         method is `handleEsc`, so Esc in the side pane is not covered by tests.
2. [x] Deprecation of cmd line -> switch to specialised modal `cmd_modal` that is in the middle of
       the screen.
3. [ ] Deprecation of profile -> non-personal settings feature. "Profile" set for the entire
       installation and not user specific.
4. [ ] Window panes system to hold the sequence viewer and other "window"-features.
5. [ ] Add window-feature `annot_information`, linking and displaying annotation features.
6. [ ] Search highlighting in the sequence viewer: mark every `/` search hit, not just the cursor
       jump target. The unused `HighlightArea = {begin: number; end: number}` type (removed from
       `types/cmd_types.ts` during the cmd modal refactor) was the start of this; hits are
       absolute base offsets, so a highlight is a begin/end range mapped onto each rendered line.

## Backend

1. [x] Temporary file saving and loading mechanic for fasta/fna files.
2. [ ] Apache Arrow / DataFusion integration.
3. [ ] Codon integration.
