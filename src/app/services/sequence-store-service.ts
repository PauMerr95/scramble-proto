import { Injectable } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { EditOp, RecordMeta } from '../types/main_types';

// Thin wrapper around the sequence store commands in src-tauri/src/seq/commands.rs.
// Sequences never travel over IPC as a whole: the frontend asks for windows.
@Injectable({
  providedIn: 'root',
})
export class SequenceStoreService {
  importFasta(path: string): Promise<RecordMeta[]> {
    return invoke<RecordMeta[]>('import_fasta', { path });
  }

  listRecords(): Promise<RecordMeta[]> {
    return invoke<RecordMeta[]>('list_records');
  }

  getWindow(id: string, start: number, len: number): Promise<string> {
    return invoke<string>('get_window', { id, start, len });
  }

  applyEdits(id: string, ops: EditOp[]): Promise<RecordMeta> {
    return invoke<RecordMeta>('apply_edits', { id, ops });
  }

  search(id: string, query: string, from: number, limit: number): Promise<number[]> {
    return invoke<number[]>('search_sequence', { id, query, from, limit });
  }

  flush(id: string): Promise<boolean> {
    return invoke<boolean>('flush_record', { id });
  }
}
