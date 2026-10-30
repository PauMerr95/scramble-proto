import { Component, inject } from '@angular/core';
import { LayoutService } from '../../../../../services/layout-service';
import { SettingsService } from '../../../../../services/settings-service';
import { InputText } from '../../../../util/input-text/input-text';

@Component({
  selector: 'app-settings-scramble',
  imports: [InputText],
  template: `
  <div class="section-wrapper">
    <span class="section-title">Scramble</span>

    <div class="info-segment-wrapper"
    [class.targeted]="lyt.currentlyTargeted() === 'SettingsConfigPath'">
      <span class="info-segment-label">CONFIG:</span>
      <span class="info-segment-value">{{ settings.saved().configPath }}</span>
    </div>

    <div class="field">
      <label>Work folder</label>
      <app-input-text
      [id]="'SettingsInputWorkDir'"
      [initialValue]="settings.draftWorkDir()"
      (valueChange)="settings.draftWorkDir.set($event ?? '')"></app-input-text>
      <span class="section-hint">Root of the file tree. Created on Save if it doesn't exist.</span>
    </div>
  </div>
  `,
  styleUrl: '../settings-section.scss',
})
export class SettingsScramble {
  readonly lyt = inject(LayoutService);
  readonly settings = inject(SettingsService);
}
