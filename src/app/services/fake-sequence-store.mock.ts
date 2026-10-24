import { EditOp, RecordMeta } from '../types/main_types';

// In-memory stand-in for SequenceStoreService (the Tauri backend) used by specs.
export class FakeSequenceStore {
  readonly seqs = new Map<string, string>();
  private readonly metas = new Map<string, RecordMeta>();
  readonly receivedOps: EditOp[] = [];
  // Per-call delays (ms) for applyEdits, to simulate IPC calls resolving out of order.
  editDelays: number[] = [];

  add(id: string, sequence: string, header = `record ${id}`): RecordMeta {
    const meta: RecordMeta = { id, header, comments: [], length: sequence.length, source: null };
    this.seqs.set(id, sequence);
    this.metas.set(id, meta);
    return meta;
  }

  private meta(id: string): RecordMeta {
    return { ...this.metas.get(id)!, length: this.seqs.get(id)!.length };
  }

  listRecords = vi.fn(async (): Promise<RecordMeta[]> => [...this.metas.keys()].map(id => this.meta(id)));

  importFasta = vi.fn(async (path: string): Promise<RecordMeta[]> => [this.add(`imported${this.metas.size}`, 'ACGT', path)]);

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

  flush = vi.fn(async (): Promise<boolean> => true);
}
