import { Component, input } from '@angular/core';
import { OverlaySide } from '../../types/pane_types';

/**
 * Placeholder: will show the annotations of the sequence in its SubPane. Covers half of the
 * pane; PaneService moves it to the other half when the cursor gets behind it.
 */
@Component({
  selector: 'app-annotation-overlay',
  imports: [],
  templateUrl: './annotation-overlay.html',
  styleUrl: './annotation-overlay.scss',
})
export class AnnotationOverlay {
  readonly side = input<OverlaySide>("Right");
}
