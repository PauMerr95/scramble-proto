import { TestBed } from '@angular/core/testing';
import { clearMocks, mockIPC } from '@tauri-apps/api/mocks';
import { SequenceStoreService } from './sequence-store-service';

// Pins command names and argument shapes. The other half of this contract is
// src-tauri/tests/ipc.rs, which sends the same payloads to the real commands.
describe('SequenceStoreService', () => {
  let service: SequenceStoreService;
  let calls: [string, unknown][];

  beforeEach(() => {
    calls = [];
    mockIPC((cmd, args) => {
      calls.push([cmd, args]);
      return cmd === 'close_file' ? null : [];
    });
    TestBed.configureTestingModule({});
    service = TestBed.inject(SequenceStoreService);
  });

  afterEach(() => clearMocks());

  it('opens, saves and closes files with camelCase args', async () => {
    await service.openFasta('C:/data/genome.fna');
    await service.saveFile('f1', null, false);
    await service.saveFile('f1', '/tmp/copy.fa', true);
    await service.closeFile('f1', true);
    expect(calls).toEqual([
      ['open_fasta', { path: 'C:/data/genome.fna' }],
      ['save_file', { fileId: 'f1', path: null, force: false }],
      ['save_file', { fileId: 'f1', path: '/tmp/copy.fa', force: true }],
      ['close_file', { fileId: 'f1', force: true }],
    ]);
  });

  it('passes backend errors through as rejections', async () => {
    mockIPC(() => { throw 'genome.fna has unsaved changes (use :q! to discard them)'; });
    await expect(service.closeFile('f1', false)).rejects.toContain('unsaved changes');
  });
});
