# IMPLEMENT

## Rules

- This is a todolist for implementation of upcoming features.
- Before implementation the addition or deprecation of features needs to be planned in more
  detail. This document just holds an overview.

## Frontend

1. [x] Deprecation of sidebar -> switch to modal only. Navbar panels open in the centred modal
       (modal stack in `LayoutService`); the dead `switchMode` path and the `handleEscape` fake are
       gone.
2. [x] Deprecation of cmd line -> switch to specialised modal `cmd_modal` that is in the middle of
       the screen.
3. [ ] Deprecation of profile -> non-personal settings feature. "Profile" set for the entire
       installation and not user specific.
4. [ ] Window panes system to hold the sequence viewer and other "window"-features.
5. [ ] Add tabline and update the header to support multiple panes fluently.
6. [ ] Add window-feature `annot_information`, linking and displaying annotation features.
7. [ ] Search highlighting in the sequence viewer: mark every `/` search hit, not just the cursor
       jump target. The unused `HighlightArea = {begin: number; end: number}` type (removed from
       `types/cmd_types.ts` during the cmd modal refactor) was the start of this; hits are
       absolute base offsets, so a highlight is a begin/end range mapped onto each rendered line.

## Backend

1. [x] Temporary file saving and loading mechanic for fasta/fna files.
2. [ ] Apache Arrow / DataFusion integration.
3. [ ] Codon integration.
