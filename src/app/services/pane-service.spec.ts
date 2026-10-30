import { TestBed } from '@angular/core/testing';
import { PaneService, overlaySideFor, MIN_SPLIT, MAX_SPLIT } from './pane-service';
import { DataSessionService } from './data-session-service';
import { SequenceStoreService } from './sequence-store-service';
import { LayoutService } from './layout-service';
import { FakeSequenceStore } from './fake-sequence-store.mock';

describe('PaneService', () => {
  let panes: PaneService;
  let data: DataSessionService;
  let store: FakeSequenceStore;
  let notify: ReturnType<typeof vi.fn>;

  async function open(...sequences: string[]) {
    sequences.forEach((s, i) => store.add(`r${i}`, s));
    await data.init();
    TestBed.tick();
  }
  // Where the active viewer drew its cursor: x in an 800 px wide pane, y in a 600 px high one.
  const at = (x: number, y: number) => ({ x, paneWidth: 800, y, paneHeight: 600 });
  // Slots of every pane, column by column, top to bottom.
  const layout = () => panes.columns().map(col => col.map(pane => panes.slotOf(pane.id)));

  beforeEach(() => {
    store = new FakeSequenceStore();
    notify = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: SequenceStoreService, useValue: store },
        { provide: LayoutService, useValue: { notify } },
      ]
    });
    panes = TestBed.inject(PaneService);
    data = TestBed.inject(DataSessionService);
  });

  it('starts with one active pane in slot 1', () => {
    expect(layout()).toEqual([[1]]);
    expect(panes.activeSlot()).toBe(1);
    expect(panes.activeViewer()).toBe(panes.active().viewer);
  });

  describe('splitting', () => {
    it('Ctrl+w v adds the slot to the right, Ctrl+w s the slot below', () => {
      expect(panes.split('Vertical')).toBe(2);
      expect(layout()).toEqual([[1], [2]]);
      expect(panes.activeSlot()).toBe(2);

      panes.focus(panes.columns()[0][0].id);
      expect(panes.split('Horizontal')).toBe(3);
      expect(layout()).toEqual([[1, 3], [2]]);

      expect(panes.split('Vertical')).toBe(4);              // from 3, below the spanning 2
      expect(layout()).toEqual([[1, 3], [2, 4]]);
      expect(panes.count()).toBe(4);
    });

    it('s in slot 2 adds slot 4 while slot 3 stays empty', () => {
      panes.split('Vertical');
      expect(panes.split('Horizontal')).toBe(4);
      expect(layout()).toEqual([[1], [2, 4]]);
    });

    it('v next to an empty right column takes its top slot', () => {
      panes.split('Horizontal');                            // 1 over 3, 3 active
      expect(panes.split('Vertical')).toBe(2);
      expect(layout()).toEqual([[1, 3], [2]]);
    });

    it('refuses splits without a free slot and reports them', () => {
      panes.split('Vertical');                              // in 2
      expect(panes.split('Vertical')).toBeNull();           // nothing right of 2
      panes.split('Horizontal');                            // in 4
      expect(panes.split('Horizontal')).toBeNull();         // column full
      panes.focus(panes.columns()[0][0].id);
      expect(panes.split('Vertical')).toBeNull();           // 2 is taken
      expect(layout()).toEqual([[1], [2, 4]]);
      expect(notify).toHaveBeenCalledTimes(3);
      expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: 'Warn' }));
    });

    it('opens the source record at its cursor, then moves independently', async () => {
      await open('A'.repeat(500), 'C'.repeat(500));
      const source = panes.activeViewer();
      source.selectRecord(0);
      source.jumpTo(250);

      panes.split('Vertical');
      const copy = panes.activeViewer();
      expect(copy).not.toBe(source);
      expect(copy.activeRecord()?.id).toBe('r0');
      expect(copy.cursorOffset()).toBe(250);

      copy.moveCursor(+10);
      copy.setMode('Insert');
      expect(source.cursorOffset()).toBe(250);
      expect(source.mode()).toBe('Normal');
    });

    it('resets the divider it creates to the middle', () => {
      panes.split('Vertical');
      panes.setColSplit(0.7);
      panes.split('Horizontal');
      panes.setRowSplit(1, 0.3);
      panes.remove();
      panes.split('Horizontal');
      expect(panes.colSplit()).toBe(0.7);
      expect(panes.rowSplits()[1]).toBe(0.5);
    });
  });

  describe('moving between panes (Alt+h/j/k/l)', () => {
    function fullGrid() {
      panes.split('Vertical');
      panes.split('Horizontal');
      panes.focus(panes.columns()[0][0].id);
      panes.split('Horizontal');
      expect(layout()).toEqual([[1, 3], [2, 4]]);
      panes.focusSlot(1);
    }

    it('moves to the neighbouring slot', () => {
      fullGrid();
      const path: [Parameters<PaneService['move']>[0], number][] = [
        ['Right', 2], ['Down', 4], ['Left', 3], ['Up', 1], ['Down', 3], ['Right', 4], ['Up', 2],
      ];
      for (const [dir, slot] of path) {
        panes.move(dir);
        expect(panes.activeSlot()).toBe(slot);
      }
    });

    it('stays put at the edge of the grid', () => {
      fullGrid();
      panes.move('Left');
      panes.move('Up');
      expect(panes.activeSlot()).toBe(1);
    });

    describe('out of a full-height pane', () => {
      // 1 over 3 on the left, 2 spanning the right column.
      beforeEach(() => {
        panes.split('Horizontal');
        panes.split('Vertical');
        expect(layout()).toEqual([[1, 3], [2]]);
      });

      it('enters the pane at the height of the cursor', () => {
        panes.reportCursor(panes.active().id, at(100, 420));
        panes.move('Left');
        expect(panes.activeSlot()).toBe(3);

        panes.focusSlot(2);
        panes.reportCursor(panes.active().id, at(100, 180));
        panes.move('Left');
        expect(panes.activeSlot()).toBe(1);
      });

      it('compares against the dragged divider of the other column', () => {
        panes.setRowSplit(0, 0.8);
        panes.reportCursor(panes.active().id, at(100, 420));      // 70 %, above the divider
        panes.move('Left');
        expect(panes.activeSlot()).toBe(1);
      });

      it('takes the top pane before the cursor was drawn', () => {
        panes.move('Left');
        expect(panes.activeSlot()).toBe(1);
      });
    });

    it('enters the pane at the cursor height when moving right out of a full-height pane', () => {
      panes.split('Vertical');
      panes.split('Horizontal');
      expect(layout()).toEqual([[1], [2, 4]]);
      panes.focusSlot(1);
      panes.reportCursor(panes.active().id, at(100, 500));
      panes.move('Right');
      expect(panes.activeSlot()).toBe(4);
    });

    it('enters a spanning pane from either row', () => {
      panes.split('Horizontal');                            // 1 over 3
      panes.split('Vertical');                              // 2 spans the right column
      panes.focusSlot(3);
      panes.move('Right');
      expect(panes.activeSlot()).toBe(2);
      panes.move('Left');
      expect(panes.activeSlot()).toBe(1);                   // back into the top row
    });
  });

  describe('removing (:pd)', () => {
    it('refuses to remove the last pane', () => {
      expect(panes.remove()).toBe(false);
      expect(panes.count()).toBe(1);
      expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: 'Warn' }));
    });

    it('moves a lone pane up to the top slot of its column', () => {
      panes.split('Vertical');
      panes.split('Horizontal');
      const four = panes.active();
      panes.focusSlot(2);
      expect(panes.remove()).toBe(true);
      expect(layout()).toEqual([[1], [2]]);
      expect(panes.active()).toBe(four);
      expect(panes.activeSlot()).toBe(2);
    });

    it('moves the right column left when the left one empties', () => {
      panes.split('Vertical');
      panes.split('Horizontal');
      const [two, four] = panes.columns()[1];
      panes.focusSlot(1);
      panes.remove();
      expect(layout()).toEqual([[1, 3]]);
      expect(panes.columns()[0]).toEqual([two, four]);
      expect(panes.active()).toBe(two);
    });

    it('keeps the record open and stops the removed viewer', async () => {
      await open('ACGT', 'CCCC');
      panes.split('Vertical');
      const removed = panes.activeViewer();
      panes.remove();
      expect(data.records().length).toBe(2);

      // A live viewer would move on to r0; the removed one no longer follows the records.
      await data.closeFile('fr1', false);
      TestBed.tick();
      expect(panes.activeViewer().activeRecord()?.id).toBe('r0');
      expect(removed.activeRecord()).toBeNull();
    });
  });

  describe('records across panes', () => {
    it('shows a newly opened file in the active pane only', async () => {
      await open('ACGT');
      panes.split('Vertical');
      const [left, right] = panes.columns().map(col => col[0].viewer);

      await data.openFasta('/data/new.fa');
      TestBed.tick();
      expect(right.activeRecord()?.source).toBe('/data/new.fa');
      expect(left.activeRecord()?.id).toBe('r0');
    });

    it('keeps edits from different panes in order on one queue', async () => {
      await open('ACGT');
      panes.split('Vertical');
      const [left, right] = panes.columns().map(col => col[0].viewer);
      store.editDelays = [20, 0];

      left.insertAt(0, 'n');
      right.insertAt(0, 'r');
      expect(left.length()).toBe(6);

      await vi.waitFor(() => expect(store.receivedOps.length).toBe(2));
      expect(store.receivedOps.map(op => op.kind === 'insert' && op.bases)).toEqual(['N', 'R']);
    });

    it('refreshes every pane that shows the edited record', async () => {
      await open('ACGT');
      panes.split('Vertical');
      const [left, right] = panes.columns().map(col => col[0].viewer);
      left.setVisibleLines(0, 1);
      right.setVisibleLines(0, 1);
      await vi.waitFor(() => expect(left.lineAt(0)).toBe('ACGT'));

      right.replaceAt(0, 'g');
      await vi.waitFor(() => expect(left.lineAt(0)).toBe('GCGT'));
      expect(right.lineAt(0)).toBe('GCGT');
    });
  });

  describe('annotation overlay', () => {
    it('toggles on the active pane only and opens on the right', () => {
      panes.split('Vertical');
      panes.toggleAnnotation();
      const [left, right] = panes.columns().map(col => col[0]);
      expect(right.overlayOpen()).toBe(true);
      expect(right.overlaySide()).toBe('Right');
      expect(left.overlayOpen()).toBe(false);

      panes.toggleAnnotation();
      expect(right.overlayOpen()).toBe(false);
    });

    it('slides away from the cursor and stays until the cursor reaches it again', () => {
      panes.toggleAnnotation();
      const pane = panes.active();
      panes.reportCursor(pane.id, at(100, 0));
      expect(pane.overlaySide()).toBe('Right');
      panes.reportCursor(pane.id, at(500, 0));
      expect(pane.overlaySide()).toBe('Left');
      panes.reportCursor(pane.id, at(700, 0));
      expect(pane.overlaySide()).toBe('Left');
      panes.reportCursor(pane.id, at(399, 0));
      expect(pane.overlaySide()).toBe('Right');
    });

    it('reopens on the right', () => {
      panes.toggleAnnotation();
      panes.reportCursor(panes.active().id, at(600, 0));
      panes.toggleAnnotation();
      panes.toggleAnnotation();
      expect(panes.active().overlaySide()).toBe('Right');
    });
  });

  it('clamps dragged dividers', () => {
    panes.setColSplit(0.05);
    expect(panes.colSplit()).toBe(MIN_SPLIT);
    panes.setRowSplit(0, 0.99);
    expect(panes.rowSplits()[0]).toBe(MAX_SPLIT);
    panes.setRowSplit(1, 0.4);
    expect(panes.rowSplits()).toEqual([MAX_SPLIT, 0.4]);
  });
});

describe('overlaySideFor', () => {
  it('flips only when the cursor is behind the overlay', () => {
    expect(overlaySideFor('Right', { x: 399, paneWidth: 800 })).toBe('Right');
    expect(overlaySideFor('Right', { x: 400, paneWidth: 800 })).toBe('Left');
    expect(overlaySideFor('Left',  { x: 400, paneWidth: 800 })).toBe('Left');
    expect(overlaySideFor('Left',  { x: 399, paneWidth: 800 })).toBe('Right');
  });
});
