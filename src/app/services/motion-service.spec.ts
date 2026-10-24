import { TestBed } from '@angular/core/testing';

import { MotionService } from './motion-service';
import { LayoutService } from './layout-service';
import { SequenceViewerService, LINE_WIDTH } from './sequence-viewer-service';
import { CmdLineService } from './cmd-line-service';

describe('Motions', () => {
  let service: MotionService;
  let lytMocked: MockedLayoutService;
  let sqvMocked: MockedSequenceViewerService;
  let cliMocked: MockedCmdLineService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        MotionService,
          { provide: LayoutService,
            useClass: MockedLayoutService },
          { provide: SequenceViewerService,
            useClass: MockedSequenceViewerService},
          { provide: CmdLineService,
            useClass: MockedCmdLineService}
      ]
    });
    service = TestBed.inject(MotionService);
    lytMocked = TestBed.inject(LayoutService) as unknown as MockedLayoutService;
    sqvMocked = TestBed.inject(SequenceViewerService) as unknown as MockedSequenceViewerService;
    cliMocked = TestBed.inject(CmdLineService) as unknown as MockedCmdLineService;
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
  test.todo('MainPane(sqv): should be able to trigger "Leader" in Normal Mode');
  test.todo('MainPane(sqv): should be able to trigger "Search" in Normal Mode');
  test.todo('MainPane(sqv): should be able to trigger "Command" in Normal Mode');
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
  handleEscape = vi.fn();

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
}

class MockedCmdLineService {
  cmdInput     = vi.fn();
  cmdInputType = vi.fn();
  handleInput  = vi.fn((inputType) => this.cmdInputType.mockReturnValue(inputType));
  runInput = vi.fn();
  abort    = vi.fn(this.cmdInputType.mockReturnValue(null));

}
