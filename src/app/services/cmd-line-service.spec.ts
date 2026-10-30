import { TestBed } from '@angular/core/testing';

import { CmdLineService, LEADER_TIMEOUT_MS } from './cmd-line-service';
import { DataSessionService } from './data-session-service';
import { LayoutService } from './layout-service';
import { SequenceStoreService } from './sequence-store-service';
import { FakeSequenceStore } from './fake-sequence-store.mock';

describe('CmdLineService', () => {
  let service: CmdLineService;
  let data: DataSessionService;
  let lyt: LayoutService;
  let store: FakeSequenceStore;
  let notify: ReturnType<typeof vi.spyOn>;

  async function run(cmd: string) {
    service.open('Command');
    service.setInput(cmd);
    await service.submit();
    TestBed.tick();
  }
  const lastNotification = () => notify.mock.lastCall?.[0];

  beforeEach(async () => {
    store = new FakeSequenceStore();
    TestBed.configureTestingModule({
      providers: [{ provide: SequenceStoreService, useValue: store }]
    });
    service = TestBed.inject(CmdLineService);
    data = TestBed.inject(DataSessionService);
    lyt = TestBed.inject(LayoutService);
    notify = vi.spyOn(lyt, 'notify');
    lyt.focusOn('MainPane');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('opens and closes the modal, restoring the previous focus', () => {
    lyt.focusOn('Modal');
    service.open('Command');
    expect(service.mode()).toBe('Command');
    expect(lyt.currentFocus()).toBe('CmdModal');
    service.setInput('w');
    service.close();
    expect(service.mode()).toBe(null);
    expect(service.cmdInput()).toBe('');
    expect(lyt.currentFocus()).toBe('Modal');
  });

  it(':e opens a file and reports an already open one', async () => {
    await run('e "C:/data/genome.fna"');
    expect(store.openFasta).toHaveBeenCalledWith('C:/data/genome.fna');
    expect(lastNotification()).toEqual({ kind: 'Success', message: expect.stringContaining('Opened 1 record(s)') });
    expect(service.mode()).toBe(null);
    expect(lyt.currentFocus()).toBe('MainPane');

    await run('e C:/data/genome.fna');
    expect(lastNotification().message).toContain('already open');
    expect(data.records().length).toBe(1);
  });

  it(':w writes back, :w <path> saves as and :w! forces', async () => {
    await run('e /data/a.fa');
    const fileId = data.records()[0].fileId;

    await run('w');
    expect(store.saveFile).toHaveBeenLastCalledWith(fileId, null, false);
    expect(lastNotification()).toEqual({ kind: 'Success', message: 'Written to /data/a.fa' });

    await run('w! /data/b.fa');
    expect(store.saveFile).toHaveBeenLastCalledWith(fileId, '/data/b.fa', true);
  });

  it(':q refuses unsaved changes, :q! discards them', async () => {
    await run('e /data/a.fa');
    await store.applyEdits(data.records()[0].id, [{ kind: 'insert', offset: 0, bases: 'A' }]);

    await run('q');
    expect(lastNotification().kind).toBe('Error');
    expect(lastNotification().message).toContain('unsaved changes');
    expect(data.records().length).toBe(1);

    await run('q!');
    expect(lastNotification().kind).toBe('Success');
    expect(data.records()).toEqual([]);
  });

  it(':wq saves before closing', async () => {
    await run('e /data/a.fa');
    await store.applyEdits(data.records()[0].id, [{ kind: 'insert', offset: 0, bases: 'A' }]);
    await run('wq');
    await vi.waitFor(() => expect(data.records()).toEqual([]));
    expect(store.saveFile).toHaveBeenCalledBefore(store.closeFile);
  });

  it(':w without an open file fails', async () => {
    await run('w');
    expect(lastNotification()).toEqual({ kind: 'Error', message: 'No open file to write' });
  });

  it('reports unknown commands and ignores empty input', async () => {
    await run('nope arg');
    expect(lastNotification()).toEqual({ kind: 'Error', message: 'Could not find any commands called nope' });
    notify.mockClear();
    await run('   ');
    expect(notify).not.toHaveBeenCalled();
  });

  it('hints filter by the typed name and pin the command once args follow', () => {
    service.open('Command');
    expect(service.hints().map(h => h.key)).toContain('getJoke');
    service.setInput('w');
    expect(service.hints().map(h => h.key)).toEqual(['w', 'w!', 'wq']);
    service.setInput('w /data/out.fa');
    expect(service.hints().map(h => h.key)).toEqual(['w']);
    service.open('Search');
    expect(service.hints()).toEqual([]);
  });

  it('Tab completes to the longest common prefix', () => {
    service.open('Command');
    service.setInput('g');
    service.complete();
    expect(service.cmdInput()).toBe('getJoke ');
    service.setInput('q');
    service.complete();
    expect(service.cmdInput()).toBe('q');
    service.setInput('x');
    service.complete();
    expect(service.cmdInput()).toBe('x');
  });

  it('keeps separate histories for commands and searches', async () => {
    await run('getJoke');
    await run('w');
    service.open('Search');
    service.setInput('ACGT');
    await service.submit();

    service.open('Command');
    service.setInput('dra');
    service.historyPrev();
    expect(service.cmdInput()).toBe('w');
    service.historyPrev();
    expect(service.cmdInput()).toBe('getJoke');
    service.historyPrev();
    expect(service.cmdInput()).toBe('getJoke');
    service.historyNext();
    expect(service.cmdInput()).toBe('w');
    service.historyNext();
    expect(service.cmdInput()).toBe('dra');

    service.open('Search');
    service.historyPrev();
    expect(service.cmdInput()).toBe('ACGT');
  });

  it('leader runs a mapped key, reports an unmapped one and times out', () => {
    const toggle = vi.spyOn(lyt, 'toggleModal').mockImplementation(() => {});
    service.open('Leader');
    expect(service.hints()).toEqual([]);
    service.pressLeader('q');
    expect(toggle).toHaveBeenCalledWith('Query');
    expect(service.mode()).toBe(null);
    service.open('Leader');
    service.pressLeader('s');
    expect(toggle).toHaveBeenCalledWith('Settings');

    service.open('Leader');
    service.pressLeader('z');
    expect(lastNotification()).toEqual({ kind: 'Error', message: "No leader mapping for 'z'" });

    vi.useFakeTimers();
    service.open('Leader');
    vi.advanceTimersByTime(LEADER_TIMEOUT_MS);
    expect(service.mode()).toBe(null);
  });
});
