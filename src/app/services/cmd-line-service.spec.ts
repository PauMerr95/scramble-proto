import { TestBed } from '@angular/core/testing';

import { CmdLineService } from './cmd-line-service';

describe('CmdLineService', () => {
  let service: CmdLineService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CmdLineService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
