import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Tabline, tabLabel } from './tabline';
import { DataSessionService } from '../../services/data-session-service';
import { PaneService } from '../../services/pane-service';
import { CmdLineService } from '../../services/cmd-line-service';
import { SequenceStoreService } from '../../services/sequence-store-service';
import { FakeSequenceStore } from '../../services/fake-sequence-store.mock';

describe('Tabline', () => {
  let fixture: ComponentFixture<Tabline>;
  let store: FakeSequenceStore;
  let panes: PaneService;
  const tabs = (): HTMLElement[] => [...fixture.nativeElement.querySelectorAll('.tab')];
  const labels = () => tabs().map(tab => tab.querySelector('.tab-label')!.textContent!.trim());

  beforeEach(async () => {
    store = new FakeSequenceStore();
    store.add('r0', 'AAAA', 'NC_000913.3 Escherichia coli');
    store.add('r1', 'CCCC', 'short');
    store.add('r2', 'GGGG', 'third');
    await TestBed.configureTestingModule({
      imports: [Tabline],
      providers: [{ provide: SequenceStoreService, useValue: store }],
    }).compileComponents();

    await TestBed.inject(DataSessionService).init();
    panes = TestBed.inject(PaneService);
    fixture = TestBed.createComponent(Tabline);
    await fixture.whenStable();
  });

  it('numbers one tab per record and cuts long names after twelve characters', () => {
    expect(labels()).toEqual(['1: NC_000913.3 …', '2: short', '3: third']);
    expect(tabs()[0].title).toBe('NC_000913.3 Escherichia coli');
  });

  it('inverts the tab of the active pane and lightly marks tabs shown in other panes', async () => {
    panes.activeViewer().selectRecord(0);
    panes.split('Vertical');
    panes.activeViewer().selectRecord(1);
    await fixture.whenStable();

    expect(tabs().map(tab => tab.classList.contains('active'))).toEqual([false, true, false]);
    expect(tabs().map(tab => tab.classList.contains('shown'))).toEqual([true, true, false]);
  });

  it('opens a clicked tab in the active pane and closes one with its button', async () => {
    const closeTab = vi.spyOn(TestBed.inject(CmdLineService), 'closeTab');
    tabs()[0].click();
    await fixture.whenStable();
    expect(panes.activeViewer().activeRecordIdx()).toBe(0);

    tabs()[2].querySelector<HTMLElement>('.tab-close')!.click();
    expect(closeTab).toHaveBeenCalledWith(3);
    // The button doesn't open its tab as well.
    expect(panes.activeViewer().activeRecordIdx()).toBe(0);
  });

  it('marks tabs with unsaved changes', async () => {
    expect(fixture.nativeElement.querySelector('.unsaved-dot')).toBeNull();
    TestBed.inject(DataSessionService).patchRecord('r1', { modified: true });
    await fixture.whenStable();
    expect(tabs()[1].querySelector('.unsaved-dot')).toBeTruthy();
  });

  it('labels a record without a header by its id', () => {
    expect(tabLabel({ ...store.add('x', 'A', ''), header: '' })).toBe('x');
  });
});
