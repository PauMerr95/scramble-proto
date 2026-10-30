import { Component, Input } from '@angular/core';
import { Color } from '../../types/main_types';

@Component({
  selector: 'app-icon-ncbi-settings',
  imports: [],
  template: `
  <svg viewBox="-458 256 41.7 50" xmlns="http://www.w3.org/2000/svg" height="24px" style="max-height:100%;max-width:100%" [attr.color]="svg_color">
    <g [attr.fill]="svg_color">
      <path d="M-436.8,259.1c-12,1.1-30.1,7.5-8.4,16.7c10.8,4.6-25.8-9.5,8.3-11.7"></path>
      <path d="M-437.6,302.9c11.9-1.1,30-7.5,8.4-16.7c-10.8-4.6,25.8,9.5-8.4,11.7"></path>
      <path d="M-437.5,278.2c34.1-2.1-2.5-16.3,8.3-11.7c21.6,9.2,4.4,15.5-7.5,16.7l0,0c-34,2.3,2.5,16.2-8.4,11.7 C-466.7,285.7-449.4,279.3-437.5,278.2"></path>
    </g>
    <path d="M -420.66 262.609 L -421.17 261.378 L -420.48 260.569 L -421.42 259.641 L -422.23 260.329 L -423.49 259.812 L -423.77 258.712 L -424.7 258.712 L -425 259.826 L -426.23 260.344 L -427.03 259.641 L -427.95 260.569 L -427.28 261.399 L -427.78 262.633 L -428.9 262.889 L -428.9 263.818 L -427.76 264.122 L -427.25 265.349 L -427.95 266.139 L -427.03 267.067 L -426.19 266.389 L -424.96 266.887 L -424.68 267.995 L -423.76 267.995 L -423.47 266.887 L -422.23 266.378 C -422.03 266.525 -421.42 267.067 -421.42 267.067 L -420.48 266.139 L -421.17 265.326 L -420.66 264.096 L -419.55 263.807 L -419.55 262.889 L -420.66 262.609 Z" fill="none" [attr.stroke]="svg_color" stroke-linecap="round" stroke-linejoin="round"></path>
    <path d="M -424.23 264.851 C -423.44 264.851 -422.81 264.209 -422.81 263.417 C -422.81 262.625 -423.44 261.983 -424.23 261.983 C -425 261.983 -425.64 262.625 -425.64 263.417 C -425.64 264.209 -425 264.851 -424.23 264.851 Z" fill="none" [attr.stroke]="svg_color" stroke-linecap="round" stroke-linejoin="round"></path>
  </svg>
  `,
})
export class IconNcbiSettings {
  @Input() svg_color: Color = '#FAF0E6';
}
