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
5. [ ] Add tabline and update the header to support multiple panes fluently.
       Sequence viewer header to be replaced with tabline that is shared for all panes. Panes will not have their own toolbar anymore.
       - toolbar-hint stays 
       - toolbar-title should be removed
       - rec-label should be removed -> will be integrated into tab.
       - record-nav should be removed -> will be replaced by tabline.
       - Stretching from the left each record get a tab. Tabs are numbered 1 ... n.
       - A Tab contains "{tab_number}: {the first twelve letters of the name + ...} {a colored dot if tab contains unsaved changes} {close-btn}" close button works the same as :q.
       - Clicking a tab opens the record in the currently active pane.
       - A record in the tabline can also be opened with '<leader>{number}t' or ':openTab(number)'
       - The open tabs should be lightly highlighted but the tab in the active Subpane should be strongly highlighted (inverted colorscheme similar to active elements in rest of application)

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
