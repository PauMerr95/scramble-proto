import { ChangeDetectionStrategy, Component, inject, computed, Signal } from '@angular/core';
import { EditorMode } from '../../types/main_types';
import { CommonModule, SlicePipe } from '@angular/common';
import { SequenceViewerService } from '../../services/sequence-viewer-service';

@Component({
  selector: 'app-statusbar',
  imports: [CommonModule, SlicePipe],
  templateUrl: './statusbar.html',
  styleUrl: './statusbar.scss',
})
export class Statusbar { 
  readonly svc = inject(SequenceViewerService);

  readonly modeLabel = computed(() => {
    const map: Record<string, string> = {
      Normal: '> NORMAL',
      Insert: '> INSERT',
      Visual: '> VISUAL',
      Replace: '> REPLACE',
    };
    return map[this.svc.mode()] ?? this.svc.mode();
  });

  readonly currentLocation: Signal<string> = computed(() => {
    const offset = this.svc.cursorPos().offset;
    const line_number = this.svc.cursorPos().row;
    const column_number = this.svc.cursorPos().col;
    return `Line: ${line_number} | Offset: ${column_number} | Base#: ${offset + 1}`;
  });

  readonly selectionLength: Signal<number> = computed(() => {
    const sel = this.svc.visualSelection();
    if (!sel) return 0;
    return (Math.abs(sel.activeOffset - sel.anchorOffset) + 1);
  });
}
