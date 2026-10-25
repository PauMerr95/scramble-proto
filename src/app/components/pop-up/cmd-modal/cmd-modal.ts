import { Component, ElementRef, afterRenderEffect, inject, viewChild } from '@angular/core';
import { CmdLineService } from '../../../services/cmd-line-service';
import { IconCommand } from '../../icons/command';
import { IconSearch } from '../../icons/search';

/** Centred overlay for ':' commands and '/' search. Keys are routed by MotionService. */
@Component({
  selector: 'app-cmd-modal',
  imports: [IconCommand, IconSearch],
  templateUrl: './cmd-modal.html',
  styleUrl: './cmd-modal.scss',
})
export class CmdModal {
  readonly cli = inject(CmdLineService);
  private readonly _input = viewChild<ElementRef<HTMLInputElement>>('cmdInput');

  constructor() {
    afterRenderEffect(() => {
      this._input()?.nativeElement.focus();
    });
  }

  /** Clicking the panel must not pull focus away from the input. */
  keepFocus(e: MouseEvent) {
    e.stopPropagation();
    if (e.target !== this._input()?.nativeElement) e.preventDefault();
  }
}
