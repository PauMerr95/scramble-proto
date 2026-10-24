import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CmdLine } from './cmd-line';

describe('CmdLine', () => {
  let component: CmdLine;
  let fixture: ComponentFixture<CmdLine>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CmdLine],
    }).compileComponents();

    fixture = TestBed.createComponent(CmdLine);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
