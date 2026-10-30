import { Component, computed, inject, input } from '@angular/core';
import { Pane, PaneService } from '../../services/pane-service';
import { SequenceViewerComponent } from '../sequence-viewer-component/sequence-viewer-component';
import { AnnotationOverlay } from '../annotation-overlay/annotation-overlay';

/** One pane of the MainPane: a sequence viewer plus its annotation overlay. */
@Component({
  selector: 'app-sub-pane',
  imports: [SequenceViewerComponent, AnnotationOverlay],
  templateUrl: './sub-pane.html',
  styleUrl: './sub-pane.scss',
})
export class SubPane {
  readonly panes = inject(PaneService);
  readonly pane  = input.required<Pane>();

  readonly slot     = computed(() => this.panes.slotOf(this.pane().id));
  readonly isActive = computed(() => this.panes.active().id === this.pane().id);
}
