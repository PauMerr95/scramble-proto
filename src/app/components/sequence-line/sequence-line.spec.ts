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

  it('marks the base under the cursor with a plain cursor class', async () => {
    fixture.componentRef.setInput('line', 'ACGT');
    fixture.componentRef.setInput('cursorOffset', 2);
    fixture.componentRef.setInput('mode', 'Insert');
    await fixture.whenStable();
    const cursors = fixture.nativeElement.querySelectorAll('.cursor');
    expect(cursors.length).toBe(1);
    expect(cursors[0].textContent).toBe('G');
    expect(cursors[0].classList).toContain('cursor-insert');
  });
});
