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
3. [ ] Deprecation of profile -> non-personal settings feature. Skill: [scramble-settings](../skills/scramble-settings/SKILL.md). "Profile" set for the entire
       installation and not user specific. Remove profile pictures and delete all related files.
       Instead create a settings modal that should hold information and update options for:
       Left side column pane for section selection (30%) and right side for detailed information, buttons and dropdowns (70%)
       - scramble settings
       <!-- svg to be used in componentent icon-scramble-settings
       svg = <?xml version="1.0" encoding="UTF-8"?><svg width="24px" height="24px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" color="#000000"><path d="M2.6 4H8.77805C8.92127 4 9.05977 4.05124 9.16852 4.14445L12.3315 6.85555C12.4402 6.94876 12.5787 7 12.722 7H21.4C21.7314 7 22 7.26863 22 7.6V10.4C22 10.7314 21.7314 11 21.4 11H2.6C2.26863 11 2 10.7314 2 10.4V4.6C2 4.26863 2.26863 4 2.6 4Z" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M22 10L22 14" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M2 10V19.4C2 19.7314 2.26863 20 2.6 20H13" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M19 21C20.1046 21 21 20.1046 21 19C21 17.8954 20.1046 17 19 17C18.6357 17 18.2942 17.0974 18 17.2676C17.4022 17.6134 17 18.2597 17 19C17 19.7403 17.4022 20.3866 18 20.7324C18.2942 20.9026 18.6357 21 19 21Z" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M19 22C20.6569 22 22 20.6569 22 19C22 17.3431 20.6569 16 19 16C17.3431 16 16 17.3431 16 19C16 20.6569 17.3431 22 19 22Z" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="0.3 2"></path></svg>
       -->
              - config location (where .config.toml is stored)
              - work folder (where the filetree for "frontend update 8" / "backend update 2" will spawn)
       - Appearance
       <!-- svg to be used in componentent icon-appearance-settings
       <?xml version="1.0" encoding="UTF-8"?><svg width="24px" height="24px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" color="#000000"><path d="M2.63596 10.2927L9.70703 3.22168L18.1923 11.707L11.1212 18.778C10.3402 19.5591 9.07387 19.5591 8.29282 18.778L2.63596 13.1212C1.85492 12.3401 1.85492 11.0738 2.63596 10.2927Z" fill="#000000" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M8.29297 1.80762L9.70718 3.22183" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M19.9991 15C19.9991 15 22.9991 17.9934 22.9994 19.8865C22.9997 21.5422 21.6552 22.8865 19.9997 22.8865C18.3442 22.8865 17.012 21.5422 17 19.8865C17.0098 17.9924 19.9991 15 19.9991 15Z" fill="#000000" stroke="#000000" stroke-width="1.5" stroke-miterlimit="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>
       -->
              - Theme
       - NCBI
       <!-- svg to be used in componentent icon-ncbi-settings
       <?xml version="1.0" encoding="utf-8"?>
       <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" viewBox="-458 256 41.7 50" style="enable-background:new -458 256 41.7 50;" xmlns:bx="https://boxy-svg.com" width="41.7px" height="50px"><defs><bx:export><bx:file format="svg"/></bx:export></defs><g id="dna"><path d="M-436.8,259.1c-12,1.1-30.1,7.5-8.4,16.7c10.8,4.6-25.8-9.5,8.3-11.7" style=""/><path d="M-437.6,302.9c11.9-1.1,30-7.5,8.4-16.7c-10.8-4.6,25.8,9.5-8.4,11.7" style=""/><path d="M-437.5,278.2c34.1-2.1-2.5-16.3,8.3-11.7c21.6,9.2,4.4,15.5-7.5,16.7l0,0c-34,2.3,2.5,16.2-8.4,11.7 C-466.7,285.7-449.4,279.3-437.5,278.2" style=""/></g><path d="M -420.66 262.609 L -421.17 261.378 L -420.48 260.569 L -421.42 259.641 L -422.23 260.329 L -423.49 259.812 L -423.77 258.712 L -424.7 258.712 L -425 259.826 L -426.23 260.344 L -427.03 259.641 L -427.95 260.569 L -427.28 261.399 L -427.78 262.633 L -428.9 262.889 L -428.9 263.818 L -427.76 264.122 L -427.25 265.349 L -427.95 266.139 L -427.03 267.067 L -426.19 266.389 L -424.96 266.887 L -424.68 267.995 L -423.76 267.995 L -423.47 266.887 L -422.23 266.378 C -422.03 266.525 -421.42 267.067 -421.42 267.067 L -420.48 266.139 L -421.17 265.326 L -420.66 264.096 L -419.55 263.807 L -419.55 262.889 L -420.66 262.609 Z" style="paint-order: stroke; fill: rgba(0, 0, 0, 0); stroke: rgb(0, 0, 0); stroke-linecap: round; stroke-linejoin: round;"/><path d="M -424.23 264.851 C -423.44 264.851 -422.81 264.209 -422.81 263.417 C -422.81 262.625 -423.44 261.983 -424.23 261.983 C -425 261.983 -425.64 262.625 -425.64 263.417 C -425.64 264.209 -425 264.851 -424.23 264.851 Z" stroke-linecap="round" stroke-linejoin="round" style="paint-order: stroke; fill: rgba(0, 0, 0, 0); stroke: rgb(0, 0, 0);"/></svg>
       -->
              - API_KEY (only shows "available/unavailable - updated at __timestamp__")
       svg for settings ()
4. [ ] Window panes system to hold the sequence viewer and other "window"-features.
5. [ ] Add tabline and update the header to support multiple panes fluently.
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
