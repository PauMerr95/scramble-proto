import { TestBed } from '@angular/core/testing';
import { DataSessionService } from './data-session-service';
import { SequenceStoreService } from './sequence-store-service';
import { FakeSequenceStore } from './fake-sequence-store.mock';

describe('DataSessionService', () => {
  let service: DataSessionService;
  let store: FakeSequenceStore;

  beforeEach(() => {
    store = new FakeSequenceStore();
    TestBed.configureTestingModule({
      providers: [{ provide: SequenceStoreService, useValue: store }]
    });
    service = TestBed.inject(DataSessionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('loads record metadata (not sequences) from the backend on init', async () => {
    store.add('a1', 'ACGT');
    store.add('b2', 'GGGGCC');
    await service.init();
    expect(service.records().map(r => [r.id, r.length])).toEqual([['a1', 4], ['b2', 6]]);
    expect(store.getWindow).not.toHaveBeenCalled();
  });

  it('keeps an empty record list if the backend is unavailable', async () => {
    store.listRecords.mockRejectedValueOnce('no tauri');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await service.init();
    expect(service.records()).toEqual([]);
  });

  it('appends opened records once, even when a file is opened twice', async () => {
    store.add('a1', 'ACGT');
    await service.init();
    const opened = await service.openFasta('C:/data/new.fasta');
    expect(store.openFasta).toHaveBeenCalledWith('C:/data/new.fasta');
    expect(service.records().length).toBe(2);
    expect(service.records()[1]).toEqual(opened[0]);

    await service.openFasta('C:/data/new.fasta');
    expect(service.records().length).toBe(2);
  });

  it('takes the saved state from the backend', async () => {
    store.add('a1', 'ACGT', 'h', 'f1');
    await service.init();
    service.patchRecord('a1', { modified: true });
    await service.saveFile('f1', '/data/copy.fa', false);
    expect(store.saveFile).toHaveBeenCalledWith('f1', '/data/copy.fa', false);
    expect(service.records()[0]).toMatchObject({ modified: false, source: '/data/copy.fa' });
  });

  it('drops every record of a closed file, and keeps them if the backend refuses', async () => {
    store.add('a1', 'ACGT', 'h', 'f1');
    store.add('a2', 'GG', 'h', 'f1');
    store.add('b1', 'CC', 'h', 'f2');
    await service.init();
    await store.applyEdits('b1', [{ kind: 'insert', offset: 0, bases: 'A' }]);

    await service.closeFile('f1', false);
    expect(service.records().map(r => r.id)).toEqual(['b1']);
    await expect(service.closeFile('f2', false)).rejects.toContain('unsaved changes');
    expect(service.records().map(r => r.id)).toEqual(['b1']);
  });

  it('patches a single record', async () => {
    store.add('a1', 'ACGT');
    store.add('b2', 'ACGT');
    await service.init();
    service.patchRecord('b2', { length: 99 });
    expect(service.records().map(r => r.length)).toEqual([4, 99]);
  });
});
