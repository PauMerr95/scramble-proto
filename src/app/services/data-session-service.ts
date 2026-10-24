import { computed, inject, Injectable, signal } from '@angular/core';
import { RecordMeta } from '../types/main_types';
import { UserDataService } from './user-data';
import { NCBIDataService } from './ncbi-data-service';
import { SequenceStoreService } from './sequence-store-service';
import { QueryPacket } from '../types/side_types';

@Injectable({
  providedIn: 'root',
})
export class DataSessionService {
  readonly userData = inject(UserDataService);
  readonly ncbi     = inject(NCBIDataService);
  readonly store    = inject(SequenceStoreService);

  readonly userName          = computed<string>(()  => this.userData._USER_NAME());
  readonly isApiKeyAvailable = computed<boolean>(() => !!this.userData._API_KEY());
  readonly config_path       = computed<string>(()  => this.userData._SCRAMBLE_CONFIG());

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

  async importFasta(path: string): Promise<RecordMeta[]> {
    const imported = await this.store.importFasta(path);
    this._records.update(recs => [...recs, ...imported]);
    return imported;
  }

  patchRecord(id: string, patch: Partial<RecordMeta>): void {
    this._records.update(recs => recs.map(rec => (rec.id === id ? { ...rec, ...patch } : rec)));
  }

  getFromQuery(q: QueryPacket){
    return this.ncbi.createUrl(q);
  }
}
