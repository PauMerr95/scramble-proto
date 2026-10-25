import { EditOp, RecordMeta } from '../types/main_types';

// In-memory stand-in for SequenceStoreService (the Tauri backend) used by specs.
export class FakeSequenceStore {
  readonly seqs = new Map<string, string>();
  private readonly metas = new Map<string, RecordMeta>();
  readonly receivedOps: EditOp[] = [];
  // Per-call delays (ms) for applyEdits, to simulate IPC calls resolving out of order.
  editDelays: number[] = [];

  add(id: string, sequence: string, header = `record ${id}`, fileId = `f${id}`): RecordMeta {
    const meta: RecordMeta = {
      id, fileId, header, comments: [], length: sequence.length, source: `/data/${fileId}.fa`, modified: false,
    };
    this.seqs.set(id, sequence);
    this.metas.set(id, meta);
    return meta;
  }

  private meta(id: string): RecordMeta {
    return { ...this.metas.get(id)!, length: this.seqs.get(id)!.length };
  }

  private fileRecords(fileId: string): RecordMeta[] {
    return [...this.metas.keys()].map(id => this.meta(id)).filter(rec => rec.fileId === fileId);
  }

  listRecords = vi.fn(async (): Promise<RecordMeta[]> => [...this.metas.keys()].map(id => this.meta(id)));

  // Re-opening a path returns the records already open for it, like the backend.
  openFasta = vi.fn(async (path: string): Promise<RecordMeta[]> => {
    const open = [...this.metas.values()].filter(rec => rec.source === path);
    if (open.length) return open.map(rec => this.meta(rec.id));
    const id = `opened${this.metas.size}`;
    this.add(id, 'ACGT', path, `file${this.metas.size}`);
    this.metas.get(id)!.source = path;
    return [this.meta(id)];
  });

  saveFile = vi.fn(async (fileId: string, path: string | null, force: boolean): Promise<RecordMeta[]> => {
    for (const rec of this.fileRecords(fileId)) {
      this.metas.set(rec.id, { ...this.metas.get(rec.id)!, modified: false, source: path ?? rec.source });
    }
    return this.fileRecords(fileId);
  });

  closeFile = vi.fn(async (fileId: string, force: boolean): Promise<void> => {
    const recs = this.fileRecords(fileId);
    if (!force && recs.some(rec => rec.modified)) throw `${recs[0].source} has unsaved changes (use :q! to discard them)`;
    recs.forEach(rec => { this.metas.delete(rec.id); this.seqs.delete(rec.id); });
  });

  getWindow = vi.fn(async (id: string, start: number, len: number): Promise<string> =>
    this.seqs.get(id)!.slice(start, start + len));

  applyEdits = vi.fn(async (id: string, ops: EditOp[]): Promise<RecordMeta> => {
    const delay = this.editDelays.shift() ?? 0;
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    let seq = this.seqs.get(id)!;
    for (const op of ops) {
      switch (op.kind) {
        case 'insert':
          if (op.offset > seq.length) throw `insert at ${op.offset} is past the end`;
          seq = seq.slice(0, op.offset) + op.bases + seq.slice(op.offset);
          break;
        case 'delete':
          if (op.offset + op.len > seq.length) throw `range ${op.offset}+${op.len} exceeds length`;
          seq = seq.slice(0, op.offset) + seq.slice(op.offset + op.len);
          break;
        case 'replace':
          seq = seq.slice(0, op.offset) + op.bases + seq.slice(op.offset + op.bases.length);
          break;
      }
      this.receivedOps.push(op);
    }
    this.seqs.set(id, seq);
    this.metas.get(id)!.modified = true;
    return this.meta(id);
  });

  search = vi.fn(async (id: string, query: string, from: number, limit: number): Promise<number[]> => {
    const seq = this.seqs.get(id)!.toUpperCase();
    const hits: number[] = [];
    for (let i = seq.indexOf(query.toUpperCase(), from); i >= 0 && hits.length < limit; i = seq.indexOf(query.toUpperCase(), i + 1)) {
      hits.push(i);
    }
    return hits;
  });
}
