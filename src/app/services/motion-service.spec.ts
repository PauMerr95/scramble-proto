import { inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { MotionService } from './motion-service';
import { LayoutService } from './layout-service';
import { SequenceViewerService, LINE_WIDTH } from './sequence-viewer-service';
import { CmdLineService } from './cmd-line-service';
import { PaneService } from './pane-service';

describe('Motions', () => {
  let service: MotionService;
  let lytMocked: MockedLayoutService;
  let sqvMocked: MockedSequenceViewerService;
  let cliMocked: MockedCmdLineService;
  let panesMocked: MockedPaneService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        MotionService,
          { provide: LayoutService,
            useClass: MockedLayoutService },
          { provide: SequenceViewerService,
            useClass: MockedSequenceViewerService},
          { provide: CmdLineService,
            useClass: MockedCmdLineService},
          { provide: PaneService,
            useClass: MockedPaneService}
      ]
    });
    service = TestBed.inject(MotionService);
    lytMocked = TestBed.inject(LayoutService) as unknown as MockedLayoutService;
    sqvMocked = TestBed.inject(SequenceViewerService) as unknown as MockedSequenceViewerService;
    cliMocked = TestBed.inject(CmdLineService) as unknown as MockedCmdLineService;
    panesMocked = TestBed.inject(PaneService) as unknown as MockedPaneService;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  })

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('MainPane(sqv): should handle move events in Normal Mode', () => {
    const mvTable: keyTriggerEvent[] = [
      { key: 'h', callTo: { fn: service.sqv.moveCursor,      param: [-1]          }},
      { key: 'j', callTo: { fn: service.sqv.moveCursor,      param: [+LINE_WIDTH] }},
      { key: 'k', callTo: { fn: service.sqv.moveCursor,      param: [-LINE_WIDTH] }},
      { key: 'l', callTo: { fn: service.sqv.moveCursor,      param: [+1]          }},
      { key: 'w', callTo: { fn: service.sqv.moveCursor,      param: [+3]          }},
      { key: 'b', callTo: { fn: service.sqv.moveCursor,      param: [-3]          }},
      { key: '0', callTo: { fn: service.sqv.moveToLineStart, param: [] }},
      { key: '^', callTo: { fn: service.sqv.moveToLineStart, param: [] }},
      { key: '$', callTo: { fn: service.sqv.moveToLineEnd,   param: [] }},
      { key: 'g', callTo: { fn: service.sqv.moveToStart,     param: [] }},
      { key: 'G', callTo: { fn: service.sqv.moveToEnd,       param: [] }}
    ];
    for (const trigger of mvTable) {
      service.lyt.focusOn("MainPane");
      service.sqv.setMode("Normal");
      service.handleKeyDown(new KeyboardEvent('keyDown', { key: trigger.key }));
      expect(trigger.callTo.fn).toHaveBeenCalledWith(...trigger.callTo.param);
      vi.clearAllMocks();
    }
  })

  test.todo('MainPane(sqv): should handle mode change events in Normal Mode');
  test.todo('MainPane(sqv): should be able to "Escape" back into Normal Mode');
  it('MainPane(sqv): should open the cmd modal from Normal Mode', () => {
    const table: [string, string][] = [[' ', 'Leader'], ['/', 'Search'], [':', 'Command']];
    for (const [key, mode] of table) {
      service.lyt.focusOn("MainPane");
      service.sqv.setMode("Normal");
      service.handleKeyDown(new KeyboardEvent('keydown', { key }));
      expect(cliMocked.open).toHaveBeenCalledWith(mode);
    }
  });

  it('MainPane(panes): acts on the viewer of the active pane', () => {
    expect(service.sqv).toBe(sqvMocked);
    const other = new MockedSequenceViewerService();
    panesMocked.activeViewer.mockReturnValue(other as unknown as SequenceViewerService);
    service.lyt.focusOn("MainPane");
    service.handleKeyDown(new KeyboardEvent('keydown', { key: 'l' }));
    expect(other.moveCursor).toHaveBeenCalledWith(+1);
    expect(sqvMocked.moveCursor).not.toHaveBeenCalled();
  });

  it('MainPane(panes): Ctrl+w v / Ctrl+w s split the active pane', () => {
    service.lyt.focusOn("MainPane");
    const table: [string, boolean, string][] = [
      ['v', false, 'Vertical'], ['s', false, 'Horizontal'], ['v', true, 'Vertical'], ['s', true, 'Horizontal'],
    ];
    for (const [key, ctrlKey, axis] of table) {
      const prefix = new KeyboardEvent('keydown', { key: 'w', ctrlKey: true, cancelable: true });
      service.handleKeyDown(prefix);
      expect(prefix.defaultPrevented).toBe(true);          // the webview must not close the window
      service.handleKeyDown(new KeyboardEvent('keydown', { key: 'Control', ctrlKey: true }));
      service.handleKeyDown(new KeyboardEvent('keydown', { key, ctrlKey }));
      expect(panesMocked.split).toHaveBeenLastCalledWith(axis);
    }
    expect(panesMocked.split).toHaveBeenCalledTimes(4);
    expect(sqvMocked.setMode).not.toHaveBeenCalledWith('Visual');
  });

  it('MainPane(panes): any other key after Ctrl+w cancels the prefix and is swallowed', () => {
    service.lyt.focusOn("MainPane");
    service.handleKeyDown(new KeyboardEvent('keydown', { key: 'w', ctrlKey: true }));
    service.handleKeyDown(new KeyboardEvent('keydown', { key: 'x' }));
    expect(panesMocked.split).not.toHaveBeenCalled();
    expect(sqvMocked.deleteAt).not.toHaveBeenCalled();

    service.handleKeyDown(new KeyboardEvent('keydown', { key: 'x' }));
    expect(sqvMocked.deleteAt).toHaveBeenCalledOnce();
  });

  it('MainPane(panes): Ctrl+w does not stay armed once the focus leaves the main pane', () => {
    service.lyt.focusOn("MainPane");
    service.handleKeyDown(new KeyboardEvent('keydown', { key: 'w', ctrlKey: true }));
    service.lyt.focusOn("Modal");
    service.handleKeyDown(new KeyboardEvent('keydown', { key: 'j' }));
    service.lyt.focusOn("MainPane");
    service.handleKeyDown(new KeyboardEvent('keydown', { key: 'x' }));
    expect(sqvMocked.deleteAt).toHaveBeenCalledOnce();
  });

  it('MainPane(panes): pane keys work in Insert mode without typing', () => {
    service.lyt.focusOn("MainPane");
    sqvMocked.setMode('Insert');
    service.handleKeyDown(new KeyboardEvent('keydown', { key: 'w', ctrlKey: true }));
    service.handleKeyDown(new KeyboardEvent('keydown', { key: 's' }));
    service.handleKeyDown(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', altKey: true }));
    service.handleKeyDown(new KeyboardEvent('keydown', { key: 'h', code: 'KeyH', altKey: true }));
    expect(panesMocked.split).toHaveBeenCalledWith('Horizontal');
    expect(panesMocked.move).toHaveBeenCalledWith('Left');
    expect(sqvMocked.insertAt).not.toHaveBeenCalled();
  });

  it('MainPane(panes): Alt+h/j/k/l move between panes', () => {
    service.lyt.focusOn("MainPane");
    // e.code, since Alt changes e.key on some layouts (macOS: Alt+h is '˙').
    const table: [string, string, string][] = [
      ['˙', 'KeyH', 'Left'], ['j', 'KeyJ', 'Down'], ['k', 'KeyK', 'Up'], ['l', 'KeyL', 'Right'],
    ];
    for (const [key, code, dir] of table) {
      const e = new KeyboardEvent('keydown', { key, code, altKey: true, cancelable: true });
      service.handleKeyDown(e);
      expect(panesMocked.move).toHaveBeenLastCalledWith(dir);
      expect(e.defaultPrevented).toBe(true);
    }
    expect(sqvMocked.moveCursor).not.toHaveBeenCalled();
  });

  it('CmdModal: should route control keys and let text reach the input', () => {
    service.lyt.focusOn("CmdModal");
    cliMocked.mode.mockReturnValue("Command");
    const table: [string, (...arg: any) => void][] = [
      ['Enter', cliMocked.submit], ['ArrowUp', cliMocked.historyPrev],
      ['ArrowDown', cliMocked.historyNext], ['Tab', cliMocked.complete], ['Escape', cliMocked.close],
    ];
    for (const [key, fn] of table) {
      const e = new KeyboardEvent('keydown', { key, cancelable: true });
      service.handleKeyDown(e);
      expect(fn).toHaveBeenCalledOnce();
      expect(e.defaultPrevented).toBe(true);
    }
    const typed = new KeyboardEvent('keydown', { key: 'e', cancelable: true });
    service.handleKeyDown(typed);
    expect(typed.defaultPrevented).toBe(false);
  });

  it('CmdModal: should pass single keys to the leader and ignore bare modifiers', () => {
    service.lyt.focusOn("CmdModal");
    cliMocked.mode.mockReturnValue("Leader");
    service.handleKeyDown(new KeyboardEvent('keydown', { key: 'Shift' }));
    expect(cliMocked.pressLeader).not.toHaveBeenCalled();
    service.handleKeyDown(new KeyboardEvent('keydown', { key: 'f' }));
    expect(cliMocked.pressLeader).toHaveBeenCalledWith('f');
  });

  it('Modal: should route grid moves, Enter and Esc to the layout service', () => {
    service.lyt.focusOn("Modal");
    const table: [string, (...arg: any) => void][] = [
      ['j', lytMocked.moveDown], ['k', lytMocked.moveUp], ['h', lytMocked.moveLeft],
      ['l', lytMocked.moveRight], ['Enter', lytMocked.handleEnter], ['Escape', lytMocked.handleEsc],
    ];
    for (const [key, fn] of table) {
      service.handleKeyDown(new KeyboardEvent('keydown', { key }));
      expect(fn).toHaveBeenCalledOnce();
    }
    service.handleKeyDown(new KeyboardEvent('keydown', { key: ' ' }));
    expect(cliMocked.open).toHaveBeenCalledWith('Leader');
  });
});

interface keyTriggerEvent {
  key: string,
  callTo: {fn: (...arg: any) => void, param: any[] }
}

class MockedLayoutService {
  currentFocus = vi.fn();
  activeInput  = vi.fn();
  notify       = vi.fn();
  focusOn      = vi.fn((focus: string) => {
    this.currentFocus.mockReturnValue(focus);
  });

  moveDown  = vi.fn();
  moveUp    = vi.fn();
  moveLeft  = vi.fn();
  moveRight = vi.fn();

  handleEnter  = vi.fn();
  handleEsc    = vi.fn();

  toggleInput = vi.fn();
  _setInput = (input: string) => this.currentFocus.mockReturnValue(input);
}

class MockedSequenceViewerService {
  mode    = vi.fn().mockReturnValue("Normal");
  setMode = vi.fn((mode) => this.mode.mockReturnValue(mode));
  moveCursor = vi.fn();
  moveToLineStart = vi.fn();
  moveToLineEnd = vi.fn();
  moveToStart = vi.fn();
  moveToEnd   = vi.fn();

  cursorPos = vi.fn().mockReturnValue({row: 0, col: 0, offset: 0});
  replaceAt = vi.fn();
  deleteAt = vi.fn();
  deleteSelection = vi.fn();
  insertAt = vi.fn();
}

class MockedPaneService {
  readonly viewer = inject(SequenceViewerService);
  activeViewer = vi.fn(() => this.viewer);
  split = vi.fn();
  move  = vi.fn();
}

class MockedCmdLineService {
  mode        = vi.fn().mockReturnValue(null);
  open        = vi.fn((mode) => this.mode.mockReturnValue(mode));
  close       = vi.fn(() => this.mode.mockReturnValue(null));
  submit      = vi.fn();
  pressLeader = vi.fn();
  historyPrev = vi.fn();
  historyNext = vi.fn();
  complete    = vi.fn();
}
