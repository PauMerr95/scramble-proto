import { Component, ElementRef, inject, viewChild, effect, afterRenderEffect } from '@angular/core';
import { LayoutService } from '../../../services/layout-service';
import { CmdLineService } from '../../../services/cmd-line-service';
import { IconSearch } from "../../icons/search";
import { IconIdle } from "../../icons/idle";
import { IconLeader } from '../../icons/leader';
import { IconCommand } from '../../icons/command';
import { Color } from '../../../types/main_types';

@Component({
  selector: 'app-input',
  imports: [IconIdle, IconLeader, IconSearch, IconCommand],
  template: `
    @if (this.cli.cmdInputType() === null) {
      <app-icon-idle class="icon" svg_color="#FFFFFF"></app-icon-idle>
    }
    @if (this.cli.cmdInputType() === "Command") {
      <app-icon-command class="icon" svg_color="#e362f2"></app-icon-command>
    }
    @if (this.cli.cmdInputType() === "Leader") {
      <app-icon-leader class="icon" svg_color="#ffe563"></app-icon-leader>
    }
    @if (this.cli.cmdInputType() === "Search") {
      <app-icon-search class="icon" svg_color="#94ff8c"></app-icon-search>
    }
    <input #cmdInput class='cmd-input-field' type=text [value]="cli.cmdInput()"/>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: flex-start;
      gap: 10px
    }
    .icon {
      display: flex;
    }
    .cmd-input-field {
      width: 100%;
      max-height: 20px;
      color: inherit;
      background: inherit;
      border: 0;
      font-family: inherit;
      font-size: 16px;
      padding-bottom: 2px;
    }
    .cmd-input-field:hover {
      cursor: default;
    }
    .cmd-input-field:focus {
      outline: none;
    }
  `,
  standalone: true,
})
export class CmdInput {
  protected readonly lyt = inject(LayoutService);
  protected readonly cli = inject(CmdLineService);
  private readonly _inputRef = viewChild.required<ElementRef<HTMLInputElement>>('cmdInput');

  constructor(lyt: LayoutService, cli: CmdLineService) {
    afterRenderEffect(() => {
      const el = this._inputRef().nativeElement;
      el.onclick = null;
      el.addEventListener('mousedown', (e) => e.preventDefault());
    });
    effect(() => {
      if (this.lyt.currentFocus() === "CmdLine") {
        this._inputRef().nativeElement.focus();
      }
      if (!this.cli.cmdInput()) {
        this._inputRef().nativeElement.value = '';
      }
    });
  }
}
