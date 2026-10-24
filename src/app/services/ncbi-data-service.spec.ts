import { TestBed } from '@angular/core/testing';

import { NCBIDataService } from './ncbi-data-service';
import { QueryPacket } from '../types/side_types';

describe('NCBIDataService', () => {
  let service: NCBIDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NCBIDataService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should generate URIs from a stable QueryPacket', () => {
    for (let queryPacket of _stableQueryPackets) {
      const URI = service.createUrl(queryPacket);
      expect(URI).toMatch(/https:\/\/api\.ncbi\.nlm\.nih\.gov\/datasets\/v2\/*\/*/);
      expect(URI).toContain(queryPacket.specifier);
    }
  });
});

const _queryPacket1: QueryPacket = {
  how: "Assembly Accession",
  what: "Sequence Report",
  specifier: "GCF_000001635.27",
}
const _queryPacket2: QueryPacket = {
  how: "Nucleotide Accession",
  what: "Assembly Accession",
  specifier: "NC_000001.11",
}
const _stableQueryPackets = Array(_queryPacket1, _queryPacket2);
