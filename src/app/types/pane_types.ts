// SubPanes sit in a 2x2 grid of slots, numbered left to right, top to bottom:
//   1 | 2
//   --+--
//   3 | 4
// A pane alone in its column takes the column's top slot and spans its full height.
export const paneSlots = [1, 2, 3, 4] as const;
export type PaneSlot = typeof paneSlots[number];

export const MAX_PANES = paneSlots.length;

// Ctrl+w v splits to the right, Ctrl+w s below.
export type SplitAxis = "Vertical" | "Horizontal";
export type PaneDirection = "Left" | "Down" | "Up" | "Right";

export type OverlaySide = "Left" | "Right";

/**
 * Where the cursor of a pane's viewer is drawn, in px: x from the left edge of the area the
 * overlay covers, y from the top of the whole pane.
 */
export interface CursorPlace {
  x: number;
  paneWidth: number;
  y: number;
  paneHeight: number;
}

/** A draggable divider: between the columns, or between the two panes of column `col`. */
export type DividerTarget = { kind: "Col" } | { kind: "Row"; col: number };
