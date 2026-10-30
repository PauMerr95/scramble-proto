import {
  computed,
  createEnvironmentInjector,
  effect,
  EnvironmentInjector,
  inject,
  Injectable,
  Signal,
  signal,
  untracked,
  WritableSignal } from '@angular/core';
import { CursorPlace, MAX_PANES, OverlaySide, PaneDirection, PaneSlot, SplitAxis } from '../types/pane_types';
import { SequenceViewerService } from './sequence-viewer-service';
import { DataSessionService } from './data-session-service';
import { LayoutService } from './layout-service';

export const MIN_SPLIT = 0.15;      // dividers can't squeeze a pane below 15 %
export const MAX_SPLIT = 0.85;

/** A SubPane as components see it: read-only, changed through PaneService. */
export interface Pane {
  readonly id: number;
  readonly viewer: SequenceViewerService;
  readonly overlayOpen: Signal<boolean>;
  readonly overlaySide: Signal<OverlaySide>;
  // Height of the cursor as a fraction of the pane, 0 until the viewer drew it.
  readonly cursorY: Signal<number>;
}

interface PaneState extends Pane {
  readonly overlayOpen: WritableSignal<boolean>;
  readonly overlaySide: WritableSignal<OverlaySide>;
  readonly cursorY: WritableSignal<number>;
}

/** Slot of the pane at `row` of column `col` (see pane_types.ts). */
export function slotAt(col: number, row: number): PaneSlot {
  return (row * 2 + col + 1) as PaneSlot;
}

/**
 * The overlay covers one half of the pane. It moves to the other half once the cursor is
 * behind it and stays there until the cursor reaches it again.
 */
export function overlaySideFor(side: OverlaySide, cursor: Pick<CursorPlace, 'x' | 'paneWidth'>): OverlaySide {
  const behindRight = cursor.x >= cursor.paneWidth / 2;
  if (side === "Right" && behindRight)  return "Left";
  if (side === "Left"  && !behindRight) return "Right";
  return side;
}

/**
 * The SubPanes of the MainPane: up to two columns of up to two panes each. Every pane owns
 * a SequenceViewerService in its own injector; motions and ex-commands act on the active one.
 */
@Injectable({
  providedIn: 'root',
})
export class PaneService {
  private readonly injector = inject(EnvironmentInjector);
  private readonly data     = inject(DataSessionService);
  private readonly lyt      = inject(LayoutService);

  private nextId = 0;
  private readonly injectors = new Map<number, EnvironmentInjector>();

  private readonly _columns   = signal<PaneState[][]>([]);
  private readonly _activeId  = signal<number>(0);
  // Width of the left column, and the height of the top pane in each column (fractions).
  private readonly _colSplit  = signal<number>(0.5);
  private readonly _rowSplits = signal<[number, number]>([0.5, 0.5]);

  readonly columns: Signal<Pane[][]> = this._columns.asReadonly();
  readonly colSplit  = this._colSplit.asReadonly();
  readonly rowSplits = this._rowSplits.asReadonly();

  readonly count  = computed(() => this._columns().reduce((sum, col) => sum + col.length, 0));
  private readonly _active = computed<PaneState>(() => this.find(this._activeId())!);
  readonly active: Signal<Pane> = this._active;
  readonly activeViewer = computed(() => this.active().viewer);
  readonly activeSlot   = computed(() => this.slotOf(this._activeId()));

  constructor() {
    this._columns.set([[this.createPane()]]);
    this._activeId.set(this._columns()[0][0].id);

    // A newly opened file shows up in the active pane.
    let prevLength = this.data.records().length;
    effect(() => {
      const currLength = this.data.records().length;
      if (currLength > prevLength) untracked(() => this.activeViewer().selectRecord(currLength - 1));
      prevLength = currLength;
    });
  }

  slotOf(id: number): PaneSlot {
    const cols = this._columns();
    for (let col = 0; col < cols.length; col++) {
      const row = cols[col].findIndex(pane => pane.id === id);
      if (row >= 0) return slotAt(col, row);
    }
    throw new Error(`No pane with id ${id}`);
  }

  focus(id: number): void {
    if (this.find(id)) this._activeId.set(id);
  }
  focusSlot(slot: PaneSlot): void {
    const pane = this._columns().flat().find(p => this.slotOf(p.id) === slot);
    if (pane) this._activeId.set(pane.id);
  }

  // === SPLIT / REMOVE ===
  /**
   * Ctrl+w v adds the slot right of the active pane, Ctrl+w s the slot below it. The new pane
   * shows the same record at the same cursor and becomes active. Returns its slot, or null.
   */
  split(axis: SplitAxis): PaneSlot | null {
    const { col, row } = this.position(this._activeId());
    const cols = this._columns();
    if (this.count() >= MAX_PANES) return this.refuseSplit("Every slot is taken");

    let target: { col: number; row: number };
    if (axis === "Vertical") {
      if (col === 1) return this.refuseSplit("There is no slot right of this pane");
      const right = cols[1] ?? [];
      // A pane alone in a column always sits in its top slot.
      target = { col: 1, row: Math.min(row, right.length) };
      if (right[target.row]) return this.refuseSplit("The slot to the right is taken");
    } else {
      if (cols[col].length > 1) return this.refuseSplit("There is no slot below this pane");
      target = { col, row: 1 };
    }

    const source = this.active().viewer;
    const pane = this.createPane();
    pane.viewer.selectRecord(source.activeRecordIdx());
    pane.viewer.jumpTo(source.cursorOffset());

    this._columns.update(cs => {
      const next = cs.map(c => [...c]);
      if (!next[target.col]) next[target.col] = [];
      next[target.col].splice(target.row, 0, pane);
      return next;
    });
    if (axis === "Vertical") this._colSplit.set(0.5);
    else this._rowSplits.update(([a, b]) => (col === 0) ? [0.5, b] : [a, 0.5]);
    this._activeId.set(pane.id);
    return slotAt(target.col, target.row);
  }

  /**
   * :pd. Removes the active pane (its records stay open). A lone pane moves up to the top slot
   * of its column and an emptied left column is replaced by the right one.
   */
  remove(): boolean {
    if (this.count() <= 1) {
      this.lyt.notify({ kind: "Warn", message: "Cannot remove the last pane" });
      return false;
    }
    const id = this._activeId();
    const { col, row } = this.position(id);
    const before = this._columns();
    const cols = before
      .map(c => c.filter(pane => pane.id !== id))
      .filter(c => c.length > 0);
    this._columns.set(cols);
    // The right column keeps its row divider when it moves left.
    if (cols.length < before.length) {
      this._rowSplits.update(([a, b]) => (col === 0) ? [b, 0.5] : [a, 0.5]);
    }

    // The pane that took the place, else the one in the same row of the neighbouring column.
    const nextCol = cols[Math.min(col, cols.length - 1)];
    this._activeId.set(nextCol[Math.min(row, nextCol.length - 1)].id);

    this.injectors.get(id)!.destroy();
    this.injectors.delete(id);
    return true;
  }

  // === MOVE (Alt+h/j/k/l) ===
  move(dir: PaneDirection): void {
    const { col, row } = this.position(this._activeId());
    const cols = this._columns();
    let target: PaneState | undefined;
    switch (dir) {
      case "Up":    target = cols[col][row - 1]; break;
      case "Down":  target = cols[col][row + 1]; break;
      case "Left":
      case "Right": {
        const nextCol = col + ((dir === "Left") ? -1 : +1);
        const next = cols[nextCol];
        if (!next) break;
        if (cols[col].length === 1 && next.length === 2) {
          // Out of a full-height pane: the pane beside the cursor, by the other column's divider.
          const below = this.active().cursorY() >= this._rowSplits()[nextCol];
          target = next[below ? 1 : 0];
        } else {
          // A spanning pane covers both rows.
          target = next[Math.min(row, next.length - 1)];
        }
        break;
      }
    }
    if (target) this._activeId.set(target.id);
  }

  // === ANNOTATION OVERLAY ===
  toggleAnnotation(): void {
    const pane = this._active();
    pane.overlaySide.set("Right");
    pane.overlayOpen.update(open => !open);
  }

  /** Reported by the pane's viewer after every render: moves the overlay, guides Alt+h/l. */
  reportCursor(id: number, cursor: CursorPlace): void {
    const pane = this.find(id);
    if (!pane) return;
    pane.cursorY.set(cursor.y / cursor.paneHeight);
    if (pane.overlayOpen()) pane.overlaySide.update(side => overlaySideFor(side, cursor));
  }

  // === DIVIDERS ===
  setColSplit(fraction: number): void {
    this._colSplit.set(clampSplit(fraction));
  }
  setRowSplit(col: number, fraction: number): void {
    this._rowSplits.update(([a, b]) => (col === 0) ? [clampSplit(fraction), b] : [a, clampSplit(fraction)]);
  }

  // === PRIVATE ===
  private find(id: number): PaneState | undefined {
    return this._columns().flat().find(pane => pane.id === id);
  }

  private createPane(): PaneState {
    const injector = createEnvironmentInjector([SequenceViewerService], this.injector);
    const id = this.nextId++;
    this.injectors.set(id, injector);
    return {
      id,
      viewer: injector.get(SequenceViewerService),
      overlayOpen: signal(false),
      overlaySide: signal<OverlaySide>("Right"),
      cursorY: signal(0),
    };
  }

  private position(id: number): { col: number; row: number } {
    const slot = this.slotOf(id) - 1;
    return { col: slot % 2, row: Math.floor(slot / 2) };
  }

  private refuseSplit(reason: string): null {
    this.lyt.notify({ kind: "Warn", message: `Cannot split: ${reason}` });
    return null;
  }
}

function clampSplit(fraction: number): number {
  return Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, fraction));
}
