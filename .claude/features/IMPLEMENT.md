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
3. [x] Deprecation of profile -> non-personal settings feature. Skill: [scramble-settings](../skills/scramble-settings/SKILL.md).
4. [x] Window panes system (new feature) to hold the sequence viewer and an annotation overlay (new feature).
5. [x] Add tabline and update the header to support multiple panes fluently.
6. [ ] Add window-feature `annot_information`, linking and displaying annotation features.
7. [ ] Search highlighting in the sequence viewer: mark every `/` search hit, not just the cursor
       jump target. The unused `HighlightArea = {begin: number; end: number}` type (removed from
       `types/cmd_types.ts` during the cmd modal refactor) was the start of this; hits are
       absolute base offsets, so a highlight is a begin/end range mapped onto each rendered line.
8. [ ] Complete file/folder feature that allows user to display a filetree in a modal to choose files instead of running :e [path]
       e: without a path argument should also open the modal.
9. [ ] Apply the selected theme (CSS variables / `data-theme` on `<html>`). Settings (task 3) only
       stores and selects it.

## Backend

1. [x] Temporary file saving and loading mechanic for fasta/fna files.
2. [ ] Backend-Service for file local management
3. [ ] Apache Arrow / DataFusion integration.
4. [ ] Codon integration.
