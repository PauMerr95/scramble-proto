import { TestBed } from '@angular/core/testing';

import { CmdLineService } from './cmd-line-service';
import { DataSessionService } from './data-session-service';
import { SequenceStoreService } from './sequence-store-service';
import { FakeSequenceStore } from './fake-sequence-store.mock';

describe('CmdLineService', () => {
  let service: CmdLineService;
  let data: DataSessionService;
  let store: FakeSequenceStore;

  async function run(cmd: string) {
    service.cmdInputType.set('Command');
    service.cmdInput.set(cmd);
    service.checkCommand();
    // Ex-commands are async; wait until they reported something other than progress.
    await vi.waitFor(() => expect(service.cmdOutputType()).not.toBe('Neutral'));
    TestBed.tick();
  }

  beforeEach(async () => {
    store = new FakeSequenceStore();
    TestBed.configureTestingModule({
      providers: [{ provide: SequenceStoreService, useValue: store }]
    });
    service = TestBed.inject(CmdLineService);
    data = TestBed.inject(DataSessionService);
    service.cmdOutputType.set('Neutral');
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it(':e opens a file and reports an already open one', async () => {
    await run('e "C:/data/genome.fna"');
    expect(store.openFasta).toHaveBeenCalledWith('C:/data/genome.fna');
    expect(service.cmdOutput()).toContain('Opened 1 record(s)');

    service.cmdOutputType.set('Neutral');
    await run('e C:/data/genome.fna');
    expect(service.cmdOutput()).toContain('already open');
    expect(data.records().length).toBe(1);
  });

  it(':w writes back, :w <path> saves as and :w! forces', async () => {
    await run('e /data/a.fa');
    const fileId = data.records()[0].fileId;

    service.cmdOutputType.set('Neutral');
    await run('w');
    expect(store.saveFile).toHaveBeenLastCalledWith(fileId, null, false);
    expect(service.cmdOutput()).toBe('Written to /data/a.fa');

    service.cmdOutputType.set('Neutral');
    await run('w! /data/b.fa');
    expect(store.saveFile).toHaveBeenLastCalledWith(fileId, '/data/b.fa', true);
  });

  it(':q refuses unsaved changes, :q! discards them', async () => {
    await run('e /data/a.fa');
    await store.applyEdits(data.records()[0].id, [{ kind: 'insert', offset: 0, bases: 'A' }]);

    service.cmdOutputType.set('Neutral');
    await run('q');
    expect(service.cmdOutputType()).toBe('Failure');
    expect(service.cmdOutput()).toContain('unsaved changes');
    expect(data.records().length).toBe(1);

    service.cmdOutputType.set('Neutral');
    await run('q!');
    expect(service.cmdOutputType()).toBe('Success');
    expect(data.records()).toEqual([]);
  });

  it(':wq saves before closing', async () => {
    await run('e /data/a.fa');
    await store.applyEdits(data.records()[0].id, [{ kind: 'insert', offset: 0, bases: 'A' }]);
    service.cmdOutputType.set('Neutral');
    await run('wq');
    await vi.waitFor(() => expect(data.records()).toEqual([]));
    expect(store.saveFile).toHaveBeenCalledBefore(store.closeFile);
  });

  it(':w without an open file fails', async () => {
    await run('w');
    expect(service.cmdOutput()).toBe('No open file to write');
  });
});
