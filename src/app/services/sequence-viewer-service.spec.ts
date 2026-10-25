import { TestBed } from '@angular/core/testing';
import { SequenceViewerService, CHUNK_BASES, CHUNK_LINES, LINE_WIDTH } from './sequence-viewer-service';
import { DataSessionService } from './data-session-service';
import { SequenceStoreService } from './sequence-store-service';
import { LayoutService } from './layout-service';
import { FakeSequenceStore } from './fake-sequence-store.mock';

// 3.25 chunks worth of bases, so windowing spans several backend requests.
const LONG_SEQ = Array.from({ length: CHUNK_BASES * 3 + CHUNK_BASES / 4 }, (_, i) => 'ACGT'[i % 4]).join('');

describe('SequenceViewerService', () => {
  let seq: SequenceViewerService;
  let data: DataSessionService;
  let store: FakeSequenceStore;
  let notify: ReturnType<typeof vi.fn>;

  async function open(...sequences: string[]) {
    sequences.forEach((s, i) => store.add(`r${i}`, s));
    await data.init();
    TestBed.tick();       // runs the effect that selects the newest record
  }

  beforeEach(() => {
    store = new FakeSequenceStore();
    notify = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: SequenceStoreService, useValue: store },
        { provide: LayoutService, useValue: { notify } },
      ]
    });
    seq = TestBed.inject(SequenceViewerService);
    data = TestBed.inject(DataSessionService);
  });

  it('should be created', () => {
    expect(seq).toBeTruthy();
  });

  it('selects the newest record and exposes only its metadata', async () => {
    await open('ACGT', LONG_SEQ);
    expect(seq.activeRecordIdx()).toBe(1);
    expect(seq.length()).toBe(LONG_SEQ.length);
    expect(seq.totalLines()).toBe(Math.ceil(LONG_SEQ.length / LINE_WIDTH));
  });

  it('streams windows around the visible lines on demand', async () => {
    await open(LONG_SEQ);
    const line = CHUNK_LINES * 2 + 3;
    expect(seq.lineAt(line)).toBeNull();

    // Opening a record prefetches its start: first chunk plus one of read-ahead.
    await vi.waitFor(() => expect(seq.lineAt(0)).not.toBeNull());
    const requested = () => store.getWindow.mock.calls.map(([, start]) => start / CHUNK_BASES);
    expect(requested()).toEqual([0, 1]);

    // Scrolling to chunk 2 fetches it and chunk 3; chunk 1 is already cached.
    store.getWindow.mockClear();
    seq.setVisibleLines(line, line + 40);
    await vi.waitFor(() => expect(seq.lineAt(line)).not.toBeNull());
    expect(requested()).toEqual([2, 3]);
    expect(seq.lineAt(line)).toBe(LONG_SEQ.slice(line * LINE_WIDTH, (line + 1) * LINE_WIDTH));
  });

  it('sends edits in order even if the backend answers out of order', async () => {
    await open('ACGTACGT');
    seq.setVisibleLines(0, 1);
    store.editDelays = [20, 0, 0];

    seq.setMode('Insert');
    seq.insertAt(0, 'n');
    seq.insertAt(1, 'r');
    seq.insertAt(2, 'y');
    expect(seq.length()).toBe(11);                    // optimistic, before the backend answered
    expect(seq.cursorOffset()).toBe(3);

    await vi.waitFor(() => expect(seq.lineAt(0)).toBe('NRYACGTACGT'));
    expect(store.receivedOps.map(op => op.offset)).toEqual([0, 1, 2]);
    expect(seq.length()).toBe(11);
  });

  it('deletes the visual selection inclusively', async () => {
    await open('AAAACCCCGGGG');
    seq.setVisibleLines(0, 1);
    seq.jumpTo(4);
    seq.setMode('Visual');
    seq.moveCursor(3);
    seq.deleteSelection();
    expect(seq.length()).toBe(8);
    await vi.waitFor(() => expect(seq.lineAt(0)).toBe('AAAAGGGG'));
  });

  it('reports rejected edits and keeps processing later ones', async () => {
    await open('ACGT');
    seq.setVisibleLines(0, 1);
    store.applyEdits.mockRejectedValueOnce('boom');
    seq.replaceAt(0, 'n');
    seq.replaceAt(1, 'n');
    await vi.waitFor(() => expect(seq.lineAt(0)).toBe('ANGT'));
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: 'Error' }));
  });

  it('searches in the backend and jumps between hits', async () => {
    await open('GATTACAxxGATTACA'.replace(/x/g, 'N'));
    expect(await seq.search('gattaca')).toBe(2);
    expect(seq.cursorOffset()).toBe(0);
    seq.jumpToHit(+1);
    expect(seq.cursorOffset()).toBe(9);
    seq.jumpToHit(+1);
    expect(seq.cursorOffset()).toBe(0);              // wraps around
    seq.jumpToHit(-1);
    expect(seq.cursorOffset()).toBe(9);
  });

  it('marks edits as unsaved and saves the whole file after queued edits', async () => {
    await open('ACGT');
    seq.deleteAt(0);
    expect(seq.activeRecord()?.modified).toBe(true);
    expect(await seq.save()).toBe('/data/fr0.fa');
    expect(store.saveFile).toHaveBeenCalledWith('fr0', null, false);
    expect(store.applyEdits).toHaveBeenCalledBefore(store.saveFile);
    expect(seq.activeRecord()?.modified).toBe(false);
  });

  it('closes the active file and reloads the record that takes its place', async () => {
    await open('AAAA', 'CCCC', 'GGGG');
    seq.selectRecord(1);
    await seq.close();
    TestBed.tick();
    expect(store.closeFile).toHaveBeenCalledWith('fr1', false);
    expect(seq.records().map(r => r.id)).toEqual(['r0', 'r2']);
    expect(seq.activeRecord()?.id).toBe('r2');
    await vi.waitFor(() => expect(store.getWindow).toHaveBeenLastCalledWith('r2', 0, expect.any(Number)));
  });
});
