import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SubPane } from './sub-pane';
import { PaneService } from '../../services/pane-service';

describe('SubPane', () => {
  let fixture: ComponentFixture<SubPane>;
  let panes: PaneService;
  const query = (sel: string): HTMLElement | null => fixture.nativeElement.querySelector(sel);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubPane],
    }).compileComponents();

    panes = TestBed.inject(PaneService);
    fixture = TestBed.createComponent(SubPane);
    fixture.componentRef.setInput('pane', panes.active());
    await fixture.whenStable();
  });

  it('shows its slot number and whether it is active', async () => {
    expect(query('.pane-number')?.textContent?.trim()).toBe('1');
    expect(query('.sub-pane')?.classList).toContain('active');

    panes.split('Vertical');
    await fixture.whenStable();
    expect(query('.sub-pane')?.classList).not.toContain('active');
  });

  it('becomes active when clicked', async () => {
    const first = panes.active();
    panes.split('Vertical');
    query('.sub-pane')!.dispatchEvent(new MouseEvent('mousedown'));
    expect(panes.active()).toBe(first);
  });

  it('shows the annotation overlay on its side while open', async () => {
    expect(query('app-annotation-overlay')).toBeNull();
    panes.toggleAnnotation();
    await fixture.whenStable();
    expect(query('app-annotation-overlay .annotation-overlay')?.classList).toContain('side-right');

    panes.reportCursor(panes.active().id, { x: 600, paneWidth: 800, y: 0, paneHeight: 600 });
    await fixture.whenStable();
    expect(query('app-annotation-overlay .annotation-overlay')?.classList).toContain('side-left');
  });
});
