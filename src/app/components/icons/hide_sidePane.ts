import { Component, Input } from '@angular/core';
import { Color } from '../../types/main_types';

@Component({
  selector: 'app-icon-hideSP',
  imports: [],
  template: `
  <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" [attr.fill]="svg_color">
    <path d="M440-240 200-480l240-240 56 56-183 184 183 184-56 56Zm264 0L464-480l240-240 56 56-183 184 183 184-56 56Z"/>
  </svg>
  `,
  styles:`
    svg {
      object-fit: cover;
    }
  `,
})
export class IconHideSP {
  @Input() svg_color: Color = '#FAF0E6';
}
