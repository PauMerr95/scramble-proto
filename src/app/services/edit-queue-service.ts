import { inject, Injectable } from '@angular/core';
import { EditOp, RecordMeta } from '../types/main_types';
import { DataSessionService } from './data-session-service';
import { SequenceStoreService } from './sequence-store-service';
import { LayoutService } from './layout-service';

/** Called once an edit reached the backend: content of `recordId` from `offset` on changed. */
export type EditListener = (recordId: string, offset: number) => void;

/**
 * Sends edits to the backend strictly in order. One queue for every pane, so edits made in
 * different panes to the same record can't overtake each other.
 */
@Injectable({
  providedIn: 'root',
})
export class EditQueueService {
  private readonly data  = inject(DataSessionService);
  private readonly store = inject(SequenceStoreService);
  private readonly lyt   = inject(LayoutService);

  private queue: Promise<void> = Promise.resolve();
  private pending = 0;
  private readonly listeners = new Set<EditListener>();

  /** Resolves once every edit queued so far reached the backend. */
  settled(): Promise<void> {
    return this.queue;
  }

  /** Viewers refresh their windows through this. Returns the unsubscribe. */
  onApplied(listener: EditListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Updates the length optimistically so cursor logic stays synchronous, then sends the op.
   * The backend collects ops and writes them to disk in batches in the background.
   */
  enqueue(rec: RecordMeta, op: EditOp, lengthDelta: number): void {
    this.data.patchRecord(rec.id, { length: rec.length + lengthDelta, modified: true });
    this.pending++;

    this.queue = this.queue
      .then(async () => {
        const meta = await this.store.applyEdits(rec.id, [op]);
        // Only trust the backend's length once no optimistic updates are outstanding.
        if (this.pending === 1) this.data.patchRecord(rec.id, meta);
        this.emit(rec.id, op.offset);
      })
      .catch(async err => {
        // Must not rethrow: a rejected queue would silently drop every later edit.
        this.lyt.notify({ kind: "Error", message: `Edit rejected: ${err}` });
        try {
          const fresh = (await this.store.listRecords()).find(r => r.id === rec.id);
          if (fresh) this.data.patchRecord(rec.id, fresh);
        } catch { /* keep the optimistic state; the next successful edit corrects it */ }
        this.emit(rec.id, 0);
      })
      .finally(() => this.pending--);
  }

  private emit(recordId: string, offset: number): void {
    this.listeners.forEach(listener => listener(recordId, offset));
  }
}
