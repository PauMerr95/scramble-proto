import { Injectable } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { EditOp, RecordMeta } from '../types/main_types';

// Thin wrapper around the sequence store commands in src-tauri/src/seq/commands.rs.
// Sequences never travel over IPC as a whole: the frontend asks for windows.
@Injectable({
  providedIn: 'root',
})
export class SequenceStoreService {
  /** Opens a FASTA/FNA file as a working copy; an already open file returns its records. */
  openFasta(path: string): Promise<RecordMeta[]> {
    return invoke<RecordMeta[]>('open_fasta', { path });
  }

  /** Writes every record of the file to its source, or to `path` (save as). */
  saveFile(fileId: string, path: string | null, force: boolean): Promise<RecordMeta[]> {
    return invoke<RecordMeta[]>('save_file', { fileId, path, force });
  }

  /** Deletes the working copies. Rejects on unsaved changes unless `force`. */
  closeFile(fileId: string, force: boolean): Promise<void> {
    return invoke<void>('close_file', { fileId, force });
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
}
