import { Component, inject, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { LayoutService } from '../../../../../services/layout-service';
import { SettingsService } from '../../../../../services/settings-service';
import { InputText } from '../../../../util/input-text/input-text';
import { StdBtn } from '../../../../util/std-btn/std-btn';

/** The API key is write-only: Set and Remove commit right away, only the status is shown. */
@Component({
  selector: 'app-settings-ncbi',
  imports: [InputText, StdBtn, DatePipe],
  template: `
  <div class="section-wrapper">
    <span class="section-title">NCBI</span>

    <div class="info-segment-wrapper"
    [class.targeted]="lyt.currentlyTargeted() === 'SettingsKeyStatus'">
      <span class="info-segment-label">API KEY:</span>
      @let key = settings.saved().apiKey;
      <span class="info-segment-value">
        {{ key.available ? 'AVAILABLE' : 'NOT AVAILABLE' }}
        @if (key.source === 'Config' && key.updatedAt) {
          · updated {{ key.updatedAt | date:'medium' }}
        } @else if (key.source === 'Env') {
          · from NCBI_API_KEY
        }
      </span>
    </div>

    <div class="field">
      <label>Replace API key</label>
      <div class="field-row">
        <app-input-text #keyInput
        [id]="'SettingsInputApiKey'"
        [type]="'password'"></app-input-text>
        <div class="btn-wrapper">
          <app-std-btn
          [id]="'SettingsBtnSetKey'"
          [innerText]="'Set'"
          (onTrigger)="setKey()"></app-std-btn>
          <app-std-btn
          [id]="'SettingsBtnClearKey'"
          [innerText]="'Remove'"
          (onTrigger)="clearKey()"></app-std-btn>
        </div>
      </div>
      <span class="section-hint">Saved immediately. Without a key NCBI allows 5 requests/s, with one 10.</span>
    </div>
  </div>
  `,
  styleUrl: '../settings-section.scss',
})
export class SettingsNcbi {
  readonly lyt = inject(LayoutService);
  readonly settings = inject(SettingsService);
  readonly keyInput = viewChild.required<InputText>('keyInput');

  async setKey() {
    const key = this.keyInput().inputValueControl.value?.trim();
    if (!key) {
      this.lyt.notify({ kind: "Warn", message: "Enter an API key first" });
      return;
    }
    try {
      await this.settings.setApiKey(key);
      this.keyInput().clear();
      this.lyt.notify({ kind: "Success", message: "API key saved" });
    } catch (err) {
      this.lyt.notify({ kind: "Error", message: `Could not save API key: ${err}` });
    }
  }

  async clearKey() {
    if (this.settings.saved().apiKey.source !== "Config") {
      this.lyt.notify({ kind: "Info", message: "No API key stored in the settings" });
      return;
    }
    try {
      await this.settings.clearApiKey();
      this.lyt.notify({ kind: "Success", message: "API key removed" });
    } catch (err) {
      this.lyt.notify({ kind: "Error", message: `Could not remove API key: ${err}` });
    }
  }
}
