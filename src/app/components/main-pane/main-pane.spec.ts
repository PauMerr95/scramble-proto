import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { MainPane } from './main-pane';
import { SubPane } from '../sub-pane/sub-pane';
import { PaneService } from '../../services/pane-service';

describe('MainPane', () => {
  let component: MainPane;
  let fixture: ComponentFixture<MainPane>;
  let panes: PaneService;
  const query = (sel: string): HTMLElement[] => [...fixture.nativeElement.querySelectorAll(sel)];
  // left/top/width/height of an element, in % of the grid.
  const box = (el: HTMLElement) =>
    ['left', 'top', 'width', 'height'].map(prop => parseFloat(el.style.getPropertyValue(prop)));
  const subPanes = () => fixture.debugElement.queryAll(By.directive(SubPane))
    .map(de => de.componentInstance as SubPane);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MainPane],
    }).compileComponents();

    fixture = TestBed.createComponent(MainPane);
    component = fixture.componentInstance;
    panes = TestBed.inject(PaneService);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders one sub pane per pane, with a divider between columns and rows', async () => {
    expect(query('app-sub-pane').length).toBe(1);
    expect(query('.divider').length).toBe(0);

    panes.split('Vertical');
    await fixture.whenStable();
    expect(query('app-sub-pane').length).toBe(2);
    expect(query('.divider.col-divider').length).toBe(1);

    panes.split('Horizontal');
    await fixture.whenStable();
    expect(query('app-sub-pane').length).toBe(3);
    expect(query('.divider.row-divider').length).toBe(1);
  });

  it('places panes and dividers from the split fractions', async () => {
    panes.split('Vertical');
    panes.split('Horizontal');
    panes.setColSplit(0.3);
    panes.setRowSplit(1, 0.6);
    await fixture.whenStable();

    const [one, two, four] = query('.pane-cell').map(box);
    [[0, 0, 30, 100], [30, 0, 70, 60], [30, 60, 70, 40]].forEach((expected, i) =>
      expected.forEach((value, j) => expect([one, two, four][i][j]).toBeCloseTo(value)));

    expect(box(query('.col-divider')[0])[0]).toBeCloseTo(30);
    const [left, top, width] = box(query('.row-divider')[0]);
    expect([left, top, width].map(v => Math.round(v))).toEqual([30, 60, 70]);
  });

  it('keeps the sub panes that stay when another one is removed', async () => {
    panes.split('Vertical');
    panes.split('Horizontal');
    await fixture.whenStable();
    const byId = new Map(subPanes().map(sub => [sub.pane().id, sub]));

    panes.focusSlot(1);
    panes.remove();                     // the right column moves left
    await fixture.whenStable();
    expect(subPanes().length).toBe(2);
    for (const sub of subPanes()) expect(byId.get(sub.pane().id)).toBe(sub);
  });

  it('drags the column divider', async () => {
    panes.split('Vertical');
    await fixture.whenStable();
    const grid = query('.pane-grid')[0];
    vi.spyOn(grid, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 0, 1000, 500));

    component.startDrag({ kind: 'Col' }, new PointerEvent('pointerdown'));
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 350 }));
    expect(panes.colSplit()).toBe(0.25);
    window.dispatchEvent(new PointerEvent('pointerup'));
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 900 }));
    expect(panes.colSplit()).toBe(0.25);
  });
});
