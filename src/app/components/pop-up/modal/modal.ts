import { Component, ElementRef, afterRenderEffect, inject, viewChild } from '@angular/core';
import { RouterOutlet } from "@angular/router";
import { LayoutService } from '../../../services/layout-service';
import { modals } from '../../../types/layout_types';

/** Hosts the navbar panels (Profile, Files, Query) and their sub-modals. Keys are routed by MotionService. */
@Component({
  selector: 'app-modal',
  imports: [RouterOutlet],
  templateUrl: './modal.html',
  styleUrl: './modal.scss',
})
export class Modal {
  readonly lyt = inject(LayoutService);
  readonly modals = modals;
  private readonly _wrapper = viewChild<ElementRef<HTMLDivElement>>('modalWrapper');

  constructor() {
    // Keydown only reaches App's listener while focus sits inside it.
    afterRenderEffect(() => {
      if (this.lyt.currentFocus() === "Modal") this._wrapper()?.nativeElement.focus();
    });
  }
}
