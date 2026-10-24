import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SequenceLine } from './sequence-line';

describe('SequenceLine', () => {
  let component: SequenceLine;
  let fixture: ComponentFixture<SequenceLine>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SequenceLine],
    }).compileComponents();

    fixture = TestBed.createComponent(SequenceLine);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
