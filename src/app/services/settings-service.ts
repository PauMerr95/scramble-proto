import { computed, signal, Injectable } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { ApiKeyStatus, defaultSettingsInfo, SettingsDraft, SettingsInfo } from '../types/data_types';
import { SettingsSection, Theme } from '../types/layout_types';

/**
 * Installation-wide settings. Theme and work folder are edited as a draft and written by Save;
 * the API key is write-only and committed right away (only its status comes back).
 */
@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  private readonly _saved = signal<SettingsInfo>(defaultSettingsInfo());
  readonly saved = this._saved.asReadonly();

  // Writable so the drop down / input can bind to them directly.
  readonly draftTheme   = signal<Theme>(this._saved().theme);
  readonly draftWorkDir = signal<string>(this._saved().workDir);

  readonly dirtySections = computed<Set<SettingsSection>>(() => {
    const dirty = new Set<SettingsSection>();
    if (this.draftTheme()   !== this._saved().theme)   dirty.add("Appearance");
    if (this.draftWorkDir() !== this._saved().workDir) dirty.add("Scramble");
    return dirty;
  });
  readonly dirty = computed(() => this.dirtySections().size > 0);

  //INFO: init must be called in app bootstrap.
  async init(): Promise<void> {
    try {
      this._setSaved(await invoke<SettingsInfo>('get_settings'));
    } catch (err) {
      console.error(`SettingsService was unable to load settings, continuing with defaults: ${err}`);
    }
  }

  /** Writes the draft. Rejects with the backend's message (e.g. an unusable work folder). */
  async save(): Promise<void> {
    const draft: SettingsDraft = {
      theme: this.draftTheme(),
      workDir: this.draftWorkDir().trim(),
      lastSessionPath: this._saved().lastSessionPath,
    };
    this._setSaved(await invoke<SettingsInfo>('save_settings', { draft }));
  }

  revert(): void {
    this.draftTheme.set(this._saved().theme);
    this.draftWorkDir.set(this._saved().workDir);
  }

  async setApiKey(key: string): Promise<void> {
    this._setKeyStatus(await invoke<ApiKeyStatus>('set_api_key', { key }));
  }

  async clearApiKey(): Promise<void> {
    this._setKeyStatus(await invoke<ApiKeyStatus>('clear_api_key'));
  }

  private _setSaved(info: SettingsInfo): void {
    this._saved.set(info);
    this.revert();
  }

  private _setKeyStatus(apiKey: ApiKeyStatus): void {
    this._saved.update(info => ({ ...info, apiKey }));
  }
}
