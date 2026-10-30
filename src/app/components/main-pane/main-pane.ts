import { Component, computed, DestroyRef, ElementRef, inject, viewChild } from '@angular/core';
import { Pane, PaneService } from '../../services/pane-service';
import { SubPane } from '../sub-pane/sub-pane';
import { DividerTarget } from '../../types/pane_types';

/** Position and size in % of the grid. */
interface Box { left: number; top: number; width: number; height: number; }

/**
 * Lays out the SubPanes in up to two columns of up to two panes, split by draggable dividers.
 * Panes are one flat list placed by their boxes, so removing a pane or moving a column left
 * keeps the components (and the scroll state) of the panes that stay.
 */
@Component({
  selector: 'app-main-pane',
  imports: [SubPane],
  templateUrl: './main-pane.html',
  styleUrl: './main-pane.scss',
})
export class MainPane {
  readonly panes = inject(PaneService);
  private readonly grid = viewChild.required<ElementRef<HTMLElement>>('grid');

  private dragging: DividerTarget | null = null;

  readonly cells = computed<{ pane: Pane; box: Box }[]>(() =>
    this.panes.columns().flatMap((column, col) =>
      column.map((pane, row) => ({ pane, box: this.box(col, row) }))));

  // Dividers get their thickness from CSS, so their box leaves it out.
  readonly dividers = computed<{ target: DividerTarget; box: Partial<Box> }[]>(() => {
    const columns = this.panes.columns();
    const dividers: { target: DividerTarget; box: Partial<Box> }[] = [];
    if (columns.length === 2) {
      const left = this.panes.colSplit() * 100;
      dividers.push({ target: { kind: "Col" }, box: { left, top: 0, height: 100 } });
    }
    columns.forEach((column, col) => {
      if (column.length < 2) return;
      const { left, width } = this.box(col, 0);
      const top = this.panes.rowSplits()[col] * 100;
      dividers.push({ target: { kind: "Row", col }, box: { left, top, width } });
    });
    return dividers;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopDrag());
  }

  startDrag(target: DividerTarget, e: PointerEvent): void {
    e.preventDefault();
    this.dragging = target;
    window.addEventListener('pointermove', this.onDrag);
    window.addEventListener('pointerup', this.stopDrag);
  }

  private box(col: number, row: number): Box {
    const columns = this.panes.columns();
    const [left, width]  = span(columns.length, col, this.panes.colSplit());
    const [top,  height] = span(columns[col].length, row, this.panes.rowSplits()[col]);
    return { left, top, width, height };
  }

  // Arrow functions: they are added to and removed from window as they are.
  private readonly onDrag = (e: PointerEvent): void => {
    if (!this.dragging) return;
    // Columns span the full height, so rows are measured against the grid as well.
    const rect = this.grid().nativeElement.getBoundingClientRect();
    if (this.dragging.kind === "Col") {
      this.panes.setColSplit((e.clientX - rect.left) / rect.width);
    } else {
      this.panes.setRowSplit(this.dragging.col, (e.clientY - rect.top) / rect.height);
    }
  };

  private readonly stopDrag = (): void => {
    this.dragging = null;
    window.removeEventListener('pointermove', this.onDrag);
    window.removeEventListener('pointerup', this.stopDrag);
  };
}

/** Start and size in % of part `index` when `count` parts are split at `fraction`. */
function span(count: number, index: number, fraction: number): [number, number] {
  if (count === 1) return [0, 100];
  return (index === 0) ? [0, fraction * 100] : [fraction * 100, (1 - fraction) * 100];
}
