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

  it('appends imported records', async () => {
    store.add('a1', 'ACGT');
    await service.init();
    const imported = await service.importFasta('C:/data/new.fasta');
    expect(store.importFasta).toHaveBeenCalledWith('C:/data/new.fasta');
    expect(service.records().length).toBe(2);
    expect(service.records()[1]).toEqual(imported[0]);
  });

  it('patches a single record', async () => {
    store.add('a1', 'ACGT');
    store.add('b2', 'ACGT');
    await service.init();
    service.patchRecord('b2', { length: 99 });
    expect(service.records().map(r => r.length)).toEqual([4, 99]);
  });
});
