import { Component, Input } from '@angular/core';
import { Color } from '../../types/main_types';

@Component({
  selector: 'app-icon-command',
  imports: [],
  template: `
  <svg width="24px" height="24px" viewBox="0 0 24 24" stroke-width="1.5" fill="none" xmlns="http://www.w3.org/2000/svg" [attr.color]="svg_color">
    <path d="M8 7L3 12L8 17" [attr.stroke]="svg_color" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
    <path d="M16 7L21 12L16 17" [attr.stroke]="svg_color" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
  </svg>
  `
})
export class IconCommand {
  @Input() svg_color: Color = '#FAF0E6';
}