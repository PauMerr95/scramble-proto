import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SequenceViewerComponent } from './sequence-viewer-component';
import { PaneService } from '../../services/pane-service';
import { SequenceViewerService } from '../../services/sequence-viewer-service';

// jsdom has no ResizeObserver; this one lets a spec report a resize by hand.
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  readonly observed: Element[] = [];
  disconnected = false;
  constructor(readonly callback: ResizeObserverCallback) { FakeResizeObserver.instances.push(this); }
  observe(el: Element) { this.observed.push(el); }
  unobserve() {}
  disconnect() { this.disconnected = true; }
  resize() { this.callback([], this as unknown as ResizeObserver); }
}

describe('SequenceViewerComponent', () => {
  let component: SequenceViewerComponent;
  let fixture: ComponentFixture<SequenceViewerComponent>;
  let sqv: SequenceViewerService;

  beforeEach(async () => {
    FakeResizeObserver.instances = [];
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    await TestBed.configureTestingModule({
      imports: [SequenceViewerComponent],
    }).compileComponents();

    sqv = TestBed.inject(PaneService).activeViewer();
    fixture = TestBed.createComponent(SequenceViewerComponent);
    fixture.componentRef.setInput('sqv', sqv);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // The CDK viewport measures its height once; splitting or removing panes resizes it
  // without a window resize, which left scrolling working with the old height.
  it('re-measures the viewport and keeps the cursor line in view when the pane resizes', () => {
    const [observer] = FakeResizeObserver.instances;
    expect(observer.observed).toContain(component.viewport.elementRef.nativeElement);
    const measure = vi.spyOn(component.viewport, 'checkViewportSize');
    const scroll  = vi.spyOn(component.viewport, 'scrollToIndex').mockImplementation(() => {});   // jsdom can't scroll

    observer.resize();
    expect(measure).toHaveBeenCalledOnce();
    expect(measure).toHaveBeenCalledBefore(scroll);
  });

  it('stops observing once destroyed', () => {
    fixture.destroy();
    expect(FakeResizeObserver.instances[0].disconnected).toBe(true);
  });

  it('draws the cursor only while its pane is active', async () => {
    expect(component.cursorOnLine(0)).toBe(0);
    fixture.componentRef.setInput('active', false);
    await fixture.whenStable();
    expect(component.cursorOnLine(0)).toBeNull();
  });
});
