import { Injectable, signal, computed, inject, effect, untracked, DestroyRef } from '@angular/core';
import { EditorMode, VisualSelection, RecordMeta, EditOp } from '../types/main_types';
import { DataSessionService } from './data-session-service';
import { SequenceStoreService } from './sequence-store-service';
import { LayoutService } from './layout-service';
import { EditQueueService } from './edit-queue-service';

export const LINE_WIDTH = 90;
export const CHUNK_LINES = 256;                       // lines fetched per backend window
export const CHUNK_BASES = LINE_WIDTH * CHUNK_LINES;
export const MAX_CACHED_CHUNKS = 64;
export const SEARCH_LIMIT = 10_000;

interface Chunk {
  text: string;
  generation: number;     // stale (still shown, but refetched) when older than the current one
}

/**
 * One viewer per SubPane (PaneService creates them), each with its own record, cursor, mode
 * and window cache. Edits of all viewers go through the shared EditQueueService.
 */
@Injectable()
export class SequenceViewerService {
  readonly data  = inject(DataSessionService);
  readonly store = inject(SequenceStoreService);
  readonly lyt   = inject(LayoutService);
  readonly edits = inject(EditQueueService);

  readonly records = this.data.records;
  // Tracked by id: closing another file shifts the indices under it.
  private readonly activeRecordId = signal<string | null>(null);
  private lastIdx = 0;

  readonly activeRecord = computed<RecordMeta | null>(() => {
    const id = this.activeRecordId();
    return this.records().find(rec => rec.id === id) ?? null;
  });
  readonly activeRecordIdx = computed<number>(() =>
    this.records().findIndex(rec => rec.id === this.activeRecordId()));
  readonly length   = computed<number>(()   => this.activeRecord()?.length ?? 0);
  readonly header   = computed<string>(()   => this.activeRecord()?.header ?? '');
  readonly comments = computed<string[]>(() => this.activeRecord()?.comments ?? []);

  readonly totalLines  = computed(() => Math.ceil(this.length() / LINE_WIDTH));
  // Items for cdkVirtualFor: one number per line, the text is looked up lazily via lineAt().
  readonly lineIndices = computed(() => Array.from({ length: this.totalLines() }, (_, i) => i));

  readonly mode = signal<EditorMode>('Normal');
  readonly cursorOffset = signal<number>(0);
  readonly visualAnchor = signal<number | null>(null);
  readonly searchHits = signal<number[]>([]);

  // --- Window cache ---
  private readonly chunks = signal<Map<number, Chunk>>(new Map());
  private generation = 0;
  private readonly inflight = new Map<number, number>();    // chunk index -> requested generation
  private visibleLines = { start: 0, end: 0 };

  constructor() {
    // Newly opened files go to the active pane (PaneService); here a viewer only moves on
    // when its own record was closed, or picks the newest one while it shows nothing.
    effect(() => {
      const recs = this.records();
      untracked(() => {
        if (this.activeRecord()) return;
        if (this.activeRecordId() !== null) {
          this.selectRecord(Math.min(this.lastIdx, recs.length - 1));
        } else {
          this.selectRecord(recs.length - 1);
        }
      });
    });
    // An edit from any pane showing this record makes its windows stale.
    const unsubscribe = this.edits.onApplied((recordId, offset) => {
      if (this.activeRecord()?.id === recordId) this.invalidateFrom(offset);
    });
    inject(DestroyRef).onDestroy(unsubscribe);
  }

  readonly cursorPos = computed(() => {
    const offset = this.cursorOffset();
    return {
      row: Math.floor(offset/LINE_WIDTH),
      col: offset % LINE_WIDTH,
      offset
    }
  });

  readonly visualSelection = computed<VisualSelection | null>(() => {
    const anchor = this.visualAnchor();
    if (anchor === null) return null;
    return { anchorOffset: anchor, activeOffset: this.cursorOffset()}
  });

  //-----------------------------
  selectRecord(index: number): void {
    const recs = this.records();
    // Without any record left the viewer shows nothing.
    if (recs.length > 0 && (index < 0 || index >= recs.length)) return;

    this.activeRecordId.set(recs[index]?.id ?? null);
    this.lastIdx = Math.max(0, index);
    this.resetCache();
    this.searchHits.set([]);
    this.cursorOffset.set(0);
    this.mode.set('Normal');
    this.visualAnchor.set(null);
    this.ensureLoaded();
  }

  //--------Windowed data---------
  /** Text of one line, or null while its chunk is still loading. */
  lineAt(line: number): string | null {
    const chunk = this.chunks().get(Math.floor(line / CHUNK_LINES));
    if (!chunk) return null;
    const start = (line % CHUNK_LINES) * LINE_WIDTH;
    return chunk.text.slice(start, start + LINE_WIDTH);
  }

  /** Called by the viewer whenever the rendered range of the virtual scroll changes. */
  setVisibleLines(start: number, end: number): void {
    this.visibleLines = { start, end };
    this.ensureLoaded();
  }

  private ensureLoaded(): void {
    const rec = this.activeRecord();
    if (!rec || rec.length === 0) return;
    const lastChunk = Math.floor((rec.length - 1) / CHUNK_BASES);
    // One chunk of read-ahead on both sides of what is rendered.
    const first = Math.max(0, Math.floor(this.visibleLines.start / CHUNK_LINES) - 1);
    const last  = Math.min(lastChunk, Math.floor(this.visibleLines.end / CHUNK_LINES) + 1);
    const gen = this.generation;

    for (let c = first; c <= last; c++) {
      if (this.chunks().get(c)?.generation === gen || this.inflight.get(c) === gen) continue;
      this.fetchChunk(rec.id, c, gen);
    }
  }

  private async fetchChunk(recordId: string, chunkIdx: number, gen: number): Promise<void> {
    this.inflight.set(chunkIdx, gen);
    try {
      const text = await this.store.getWindow(recordId, chunkIdx * CHUNK_BASES, CHUNK_BASES);
      // A newer request supersedes this one after a record switch or an edit.
      if (this.activeRecord()?.id !== recordId || gen !== this.generation) return;
      this.chunks.update(map => {
        const next = new Map(map);
        next.set(chunkIdx, { text, generation: gen });
        return this.evict(next);
      });
    } catch (err) {
      this.lyt.notify({ kind: "Error", message: `Failed to load sequence window: ${err}` });
    } finally {
      if (this.inflight.get(chunkIdx) === gen) this.inflight.delete(chunkIdx);
    }
  }

  private evict(map: Map<number, Chunk>): Map<number, Chunk> {
    if (map.size <= MAX_CACHED_CHUNKS) return map;
    const center = (this.visibleLines.start + this.visibleLines.end) / 2 / CHUNK_LINES;
    const byDistance = [...map.keys()].sort((a, b) => Math.abs(b - center) - Math.abs(a - center));
    for (const c of byDistance.slice(0, map.size - MAX_CACHED_CHUNKS)) map.delete(c);
    return map;
  }

  private resetCache(): void {
    this.generation++;
    this.inflight.clear();
    this.chunks.set(new Map());
  }

  /** Content from `offset` on changed: chunks before it stay valid, the rest is refetched. */
  private invalidateFrom(offset: number): void {
    this.generation++;
    const gen = this.generation;
    const firstDirty = Math.floor(offset / CHUNK_BASES);
    this.chunks.update(map => {
      const next = new Map<number, Chunk>();
      for (const [c, chunk] of map) next.set(c, c < firstDirty ? { ...chunk, generation: gen } : chunk);
      return next;
    });
    this.ensureLoaded();
  }

  //--------Cursor Movement---------
  moveCursor(delta: number): void {
    const next = Math.max(0, Math.min(this.length() - 1, this.cursorOffset() + delta))
    this.cursorOffset.set(next);
  }
  jumpTo(absOffset: number): void {
    this.cursorOffset.set(Math.max(0, Math.min(this.length() - 1, absOffset)));
  }
  moveToLineStart(): void {
    const { row } = this.cursorPos();
    this.cursorOffset.set(row * LINE_WIDTH);
  }
  moveToLineEnd(): void {
    const { row } = this.cursorPos();
    const lineLength = Math.min(LINE_WIDTH, this.length() - row * LINE_WIDTH);
    this.cursorOffset.set(row * LINE_WIDTH + Math.max(0, lineLength - 1));
  }
  moveToStart(): void {
    this.cursorOffset.set(0);
  }
  moveToEnd(): void {
    this.cursorOffset.set(Math.max(0, this.length() - 1));
  }

  setMode(mode: EditorMode) {
    if (mode === "Visual") {
      this.visualAnchor.set(this.cursorOffset());
    } else {
      this.visualAnchor.set(null);
    }
    this.mode.set(mode);
  }

  //--------Search--------
  /** Searches the active record in the backend and jumps to the first hit after the cursor. */
  async search(query: string): Promise<number> {
    const rec = this.activeRecord();
    if (!rec || !query.trim()) return 0;
    const hits = await this.store.search(rec.id, query, 0, SEARCH_LIMIT);
    this.searchHits.set(hits);
    this.jumpToHit(+1, true);
    return hits.length;
  }

  jumpToHit(direction: 1 | -1, includeCursor = false): void {
    const hits = this.searchHits();
    if (!hits.length) return;
    const cur = this.cursorOffset();
    const target = direction > 0
      ? hits.find(h => includeCursor ? h >= cur : h > cur) ?? hits[0]
      : [...hits].reverse().find(h => h < cur) ?? hits[hits.length - 1];
    this.jumpTo(target);
  }

  //------Editing--------
  insertAt(offset: number, char: string): void {
    this.edit({ kind: "insert", offset, bases: char.toUpperCase() }, +1);
    this.moveCursor(+1);
  }
  deleteAt(offset: number) {
    const length = this.length();
    if (!length || offset < 0 || offset >= length) return;
    this.edit({ kind: "delete", offset, len: 1 }, -1);
    this.cursorOffset.set(Math.max(0, Math.min(offset, length - 2)));
  }
  replaceAt(offset: number, char: string): void {
    if (offset < 0 || offset >= this.length()) return;
    this.edit({ kind: "replace", offset, bases: char.toUpperCase() }, 0);
  }
  deleteSelection(): void {
    const sel = this.visualSelection();
    if(!sel) return;
    const from = Math.min(sel.anchorOffset, sel.activeOffset);
    const to   = Math.max(sel.anchorOffset, sel.activeOffset);   // inclusive, like the highlight
    this.edit({ kind: "delete", offset: from, len: to - from + 1 }, -(to - from + 1));
    this.cursorOffset.set(Math.max(0, Math.min(from, this.length() - 1)));
    this.setMode("Normal");
  }

  /**
   * Writes the active record's file (all its records) to its source, or to `path` (save as),
   * once every queued edit reached the backend. Returns the saved path, or null without a record.
   */
  async save(path: string | null = null, force = false): Promise<string | null> {
    const rec = this.activeRecord();
    if (!rec) return null;
    await this.edits.settled();
    const saved = await this.data.saveFile(rec.fileId, path, force);
    return saved[0]?.source ?? null;
  }

  /**
   * Closes the active record's file, or the file of `rec` (a tab's close button).
   * Returns its path, or null without a record.
   */
  async close(force = false, rec = this.activeRecord()): Promise<string | null> {
    if (!rec) return null;
    await this.edits.settled();
    await this.data.closeFile(rec.fileId, force);
    return rec.source;
  }

  private edit(op: EditOp, lengthDelta: number): void {
    const rec = this.activeRecord();
    if (!rec) return;
    this.edits.enqueue(rec, op, lengthDelta);
  }
}
