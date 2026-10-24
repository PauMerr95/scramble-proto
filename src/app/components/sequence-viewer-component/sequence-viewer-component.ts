import {
  AfterViewInit,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  untracked,
  ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ScrollingModule, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { SequenceViewerService, LINE_WIDTH } from '../../services/sequence-viewer-service';
import { SequenceLine } from '../sequence-line/sequence-line';
import { CmdLineService } from '../../services/cmd-line-service';
import { LayoutService } from '../../services/layout-service';



// Must equal the .line height in sequence-line.scss: CDK computes offsets from it without measuring.
export const ITEM_SIZE_PX = 22;
const SCROLL_MARGIN_LINES = 2;

@Component({
  selector: 'app-sequence-viewer-component',
  imports: [CdkVirtualScrollViewport, ScrollingModule, SequenceLine],
  templateUrl: './sequence-viewer-component.html',
  styleUrl: './sequence-viewer-component.scss',
})
export class SequenceViewerComponent implements AfterViewInit {
  private readonly destroyRef = inject(DestroyRef);

  constructor(
    readonly sqv: SequenceViewerService,
    readonly cli: CmdLineService,
    readonly lyt: LayoutService){
      effect(() => {
        if (this.lyt.currentFocus() === "MainPane") this.shell.nativeElement.focus();
      });
      effect(() => {
        const row = this.sqv.cursorPos().row;
        untracked(() => this.scrollToLine(row));
      });
    }

  readonly lineWidth = LINE_WIDTH;
  readonly itemSizePx = ITEM_SIZE_PX;
  @ViewChild('viewport') viewport!: CdkVirtualScrollViewport;
  @ViewChild('shell')    shell!: ElementRef<HTMLElement>;

  ngAfterViewInit(): void {
    this.shell.nativeElement.focus();
    this.lyt.focusOn("MainPane");
    this.viewport.renderedRangeStream
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(range => this.sqv.setVisibleLines(range.start, range.end));
  }

  cursorOnLine(lineIndex: number): number | null {
    const pos = this.sqv.cursorPos();
    return pos.row === lineIndex ? pos.offset : null;
  }

  trackLine(_: number, lineIndex: number): number {
    return lineIndex;
  }

  prevRecord(): void { this.sqv.selectRecord(this.sqv.activeRecordIdx() - 1); }
  nextRecord(): void { this.sqv.selectRecord(this.sqv.activeRecordIdx() + 1); }

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
}
