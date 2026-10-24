import { Component, inject, effect, HostListener } from '@angular/core';
import { RouterOutlet } from "@angular/router";
import { LayoutService } from '../../../services/layout-service';

@Component({
  selector: 'app-modal',
  imports: [RouterOutlet],
  templateUrl: './modal.html',
  styleUrl: './modal.scss',
})
export class Modal {
  readonly lyt = inject(LayoutService);

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.lyt.activeModal()) {
      this.lyt.closeModal();
    }
  }

  constructor(lyt: LayoutService) {
    this.lyt.focusOn("Modal");
  }
}
