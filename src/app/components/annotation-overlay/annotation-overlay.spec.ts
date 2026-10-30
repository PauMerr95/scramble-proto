import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnnotationOverlay } from './annotation-overlay';

describe('AnnotationOverlay', () => {
  let fixture: ComponentFixture<AnnotationOverlay>;
  const overlay = (): HTMLElement => fixture.nativeElement.querySelector('.annotation-overlay');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnnotationOverlay],
    }).compileComponents();

    fixture = TestBed.createComponent(AnnotationOverlay);
    await fixture.whenStable();
  });

  it('defaults to the right side', () => {
    expect(overlay().classList).toContain('side-right');
  });

  it('follows its side input', async () => {
    fixture.componentRef.setInput('side', 'Left');
    await fixture.whenStable();
    expect(overlay().classList).toContain('side-left');
    expect(overlay().classList).not.toContain('side-right');
  });
});
