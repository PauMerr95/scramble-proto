import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SequenceViewerComponent } from './sequence-viewer-component';

describe('SequenceViewerComponent', () => {
  let component: SequenceViewerComponent;
  let fixture: ComponentFixture<SequenceViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SequenceViewerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SequenceViewerComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
