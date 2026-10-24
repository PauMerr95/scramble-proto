import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CmdOutput } from './output';

describe('CmdOutput', () => {
  let component: CmdOutput;
  let fixture: ComponentFixture<CmdOutput>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CmdOutput],
    }).compileComponents();

    fixture = TestBed.createComponent(CmdOutput);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
