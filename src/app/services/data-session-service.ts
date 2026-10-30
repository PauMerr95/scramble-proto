import { inject, Injectable, signal } from '@angular/core';
import { RecordMeta } from '../types/main_types';
import { NCBIDataService } from './ncbi-data-service';
import { SequenceStoreService } from './sequence-store-service';
import { QueryPacket } from '../types/data_types';

@Injectable({
  providedIn: 'root',
})
export class DataSessionService {
  readonly ncbi     = inject(NCBIDataService);
  readonly store    = inject(SequenceStoreService);

  // Metadata of every stored record. Sequences stay on disk and are streamed in windows.
  private readonly _records = signal<RecordMeta[]>([]);
  readonly records = this._records.asReadonly();

  //INFO: init must be called in app bootstrap.
  async init(): Promise<void> {
    try {
      this._records.set(await this.store.listRecords());
    } catch (err) {
      console.error(`DataSessionService was unable to list stored records: ${err}`);
    }
  }

  /** Opens a file for editing. Records of an already open file are not added twice. */
  async openFasta(path: string): Promise<RecordMeta[]> {
    const opened = await this.store.openFasta(path);
    this._records.update(recs => {
      const known = new Set(recs.map(rec => rec.id));
      return [...recs, ...opened.filter(rec => !known.has(rec.id))];
    });
    return opened;
  }

  async saveFile(fileId: string, path: string | null, force: boolean): Promise<RecordMeta[]> {
    const saved = await this.store.saveFile(fileId, path, force);
    saved.forEach(rec => this.patchRecord(rec.id, rec));
    return saved;
  }

  async closeFile(fileId: string, force: boolean): Promise<void> {
    await this.store.closeFile(fileId, force);
    this._records.update(recs => recs.filter(rec => rec.fileId !== fileId));
  }

  patchRecord(id: string, patch: Partial<RecordMeta>): void {
    this._records.update(recs => recs.map(rec => (rec.id === id ? { ...rec, ...patch } : rec)));
  }

  getFromQuery(q: QueryPacket){
    return this.ncbi.createUrl(q);
  }
}
