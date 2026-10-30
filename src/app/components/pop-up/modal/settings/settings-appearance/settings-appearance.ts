import { Component, inject } from '@angular/core';
import { SettingsService } from '../../../../../services/settings-service';
import { DropDown } from '../../../../util/drop-down/drop-down';
import { themes } from '../../../../../types/layout_types';

@Component({
  selector: 'app-settings-appearance',
  imports: [DropDown],
  template: `
  <div class="section-wrapper">
    <span class="section-title">Appearance</span>

    <div class="field">
      <label>Theme</label>
      <app-drop-down
      [id]="'SettingsDDThemes'"
      [optionList]="availableThemes"
      [(activeOption)]="settings.draftTheme"></app-drop-down>
    </div>
  </div>
  `,
  styleUrl: '../settings-section.scss',
})
export class SettingsAppearance {
  readonly settings = inject(SettingsService);
  readonly availableThemes = themes;
}
