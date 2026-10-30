import {
  afterEveryRender,
  AfterViewInit,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  untracked,
  ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ScrollingModule, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { SequenceViewerService, LINE_WIDTH } from '../../services/sequence-viewer-service';
import { SequenceLine } from '../sequence-line/sequence-line';
import { LayoutService } from '../../services/layout-service';
import { CursorPlace } from '../../types/pane_types';



// Must equal the .line height in sequence-line.scss: CDK computes offsets from it without measuring.
export const ITEM_SIZE_PX = 22;
const SCROLL_MARGIN_LINES = 2;
const SCROLL_MARGIN_PX = 24;

/** The viewer of one SubPane. Projected content (the annotation overlay) covers its scroll area. */
@Component({
  selector: 'app-sequence-viewer-component',
  imports: [CdkVirtualScrollViewport, ScrollingModule, SequenceLine],
  templateUrl: './sequence-viewer-component.html',
  styleUrl: './sequence-viewer-component.scss',
})
export class SequenceViewerComponent implements AfterViewInit {
  private readonly destroyRef = inject(DestroyRef);
  readonly lyt = inject(LayoutService);

  readonly sqv    = input.required<SequenceViewerService>();
  readonly active = input<boolean>(true);
  /** Where the cursor is drawn, after every render. */
  readonly cursorPlace = output<CursorPlace>();

  // Set when the cursor moved; cleared once its line is rendered and scrolled into view.
  private followCursor = true;

  constructor() {
      effect(() => {
        // Before the view exists ngAfterViewInit focuses instead.
        if (this.lyt.currentFocus() === "MainPane" && this.active()) this.shell?.nativeElement.focus();
      });
      effect(() => {
        const row = this.sqv().cursorPos().row;
        untracked(() => {
          this.followCursor = true;
          this.scrollToLine(row);
        });
      });
      afterEveryRender(() => this.trackCursor());
    }

  readonly lineWidth = LINE_WIDTH;
  readonly itemSizePx = ITEM_SIZE_PX;
  @ViewChild('viewport') viewport!: CdkVirtualScrollViewport;
  @ViewChild('shell')    shell!: ElementRef<HTMLElement>;
  @ViewChild('area')     area!: ElementRef<HTMLElement>;

  ngAfterViewInit(): void {
    if (this.active()) {
      this.shell.nativeElement.focus();
      this.lyt.focusOn("MainPane");
    }
    this.viewport.renderedRangeStream
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(range => this.sqv().setVisibleLines(range.start, range.end));
    this.observeResize();
  }

  /** Only the active pane draws its cursor, which also marks it as the active one. */
  cursorOnLine(lineIndex: number): number | null {
    if (!this.active()) return null;
    const pos = this.sqv().cursorPos();
    return pos.row === lineIndex ? pos.offset : null;
  }

  trackLine(_: number, lineIndex: number): number {
    return lineIndex;
  }

  prevRecord(): void { this.sqv().selectRecord(this.sqv().activeRecordIdx() - 1); }
  nextRecord(): void { this.sqv().selectRecord(this.sqv().activeRecordIdx() + 1); }

  /**
   * The CDK viewport measures its height once and then only on window resizes. Splitting,
   * removing panes and dragging dividers resize it without one, so re-measure here, or
   * scrolling and the rendered range keep working with the old height.
   */
  private observeResize(): void {
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      this.viewport.checkViewportSize();
      this.scrollToLine(this.sqv().cursorPos().row);
    });
    observer.observe(this.viewport.elementRef.nativeElement);
    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  /** Keeps the cursor line in view after motions like G, j or a search jump. */
  private scrollToLine(line: number): void {
    if (!this.viewport) return;
    const firstVisible = Math.floor(this.viewport.measureScrollOffset('top') / ITEM_SIZE_PX);
    const visibleCount = Math.floor(this.viewport.getViewportSize() / ITEM_SIZE_PX);
    if (line < firstVisible + SCROLL_MARGIN_LINES) {
      this.viewport.scrollToIndex(Math.max(0, line - SCROLL_MARGIN_LINES));
    } else if (line >= firstVisible + visibleCount - SCROLL_MARGIN_LINES) {
      this.viewport.scrollToIndex(Math.max(0, line - visibleCount + SCROLL_MARGIN_LINES + 1));
    }
  }

  /**
   * Scrolls horizontally to a moved cursor (lines are wider than a narrow pane) and reports
   * where it is drawn. The cursor's line may only render a frame after a far jump.
   */
  private trackCursor(): void {
    // Runs after every render of the app: inactive panes draw no cursor, so skip them early.
    if (!this.active()) return;
    const cursor = this.viewport?.elementRef.nativeElement.querySelector<HTMLElement>('.cursor');
    if (!cursor) return;
    const scroller = this.viewport.elementRef.nativeElement;

    if (this.followCursor) {
      this.followCursor = false;
      const view = scroller.getBoundingClientRect();
      const gutter = cursor.closest('.line')?.querySelector('.line-number')?.getBoundingClientRect();
      const left = Math.max(view.left, gutter?.right ?? view.left);
      const rect = cursor.getBoundingClientRect();
      if (rect.left < left + SCROLL_MARGIN_PX) {
        scroller.scrollLeft -= left + SCROLL_MARGIN_PX - rect.left;
      } else if (rect.right > view.right - SCROLL_MARGIN_PX) {
        scroller.scrollLeft += rect.right - view.right + SCROLL_MARGIN_PX;
      }
    }

    const area  = this.area.nativeElement.getBoundingClientRect();
    const shell = this.shell.nativeElement.getBoundingClientRect();
    if (area.width === 0 || shell.height === 0) return;     // not laid out (yet)
    const rect = cursor.getBoundingClientRect();
    this.cursorPlace.emit({
      x: (rect.left + rect.right) / 2 - area.left, paneWidth: area.width,
      y: (rect.top + rect.bottom) / 2 - shell.top, paneHeight: shell.height,
    });
  }
}
