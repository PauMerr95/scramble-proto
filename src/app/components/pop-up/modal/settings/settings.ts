import { Component, effect, inject, signal, untracked } from '@angular/core';
import { LayoutService } from '../../../../services/layout-service';
import { SettingsService } from '../../../../services/settings-service';
import { settingsBaseGrid, settingsSectionIds, settingsSubGrids } from '../../../../move-grids/mv-grids-modals';
import { SettingsSection, settingsSections } from '../../../../types/layout_types';
import { StdBtn } from '../../../util/std-btn/std-btn';
import { IconScrambleSettings } from '../../../icons/icon-scramble-settings';
import { IconAppearanceSettings } from '../../../icons/icon-appearance-settings';
import { IconNcbiSettings } from '../../../icons/icon-ncbi-settings';
import { SettingsScramble } from './settings-scramble/settings-scramble';
import { SettingsAppearance } from './settings-appearance/settings-appearance';
import { SettingsNcbi } from './settings-ncbi/settings-ncbi';

/** Section list (30%) and the active section (70%). Moving onto a section switches to it. */
@Component({
  selector: 'app-settings',
  imports: [StdBtn, IconScrambleSettings, IconAppearanceSettings, IconNcbiSettings,
            SettingsScramble, SettingsAppearance, SettingsNcbi],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {
  readonly lyt = inject(LayoutService);
  readonly settings = inject(SettingsService);
  readonly sections = settingsSections;
  readonly sectionIds = settingsSectionIds;

  readonly activeSection = signal<SettingsSection>("Scramble");

  constructor() {
    // (Re)load the grid whenever focus comes back to the modal, e.g. after leaving an input.
    effect(() => {
      if (this.lyt.currentFocus() === "Modal"
          && this.lyt.activeModal() === "Settings") {
        const section = untracked(this.activeSection);
        this.lyt.loadLayeredGrid(settingsBaseGrid, settingsSubGrids[section], settingsSectionIds[section]);
      }
    });
    // Live switch: the cursor landing on a section swaps the right pane and its sub-grid.
    effect(() => {
      const target = this.lyt.currentlyTargeted();
      const section = this.sections.find(sec => settingsSectionIds[sec] === target);
      if (section && section !== untracked(this.activeSection)) this._switchTo(section);
    });
  }

  selectSection(section: SettingsSection) {
    this._switchTo(section);
    this.lyt.jumpToID(settingsSectionIds[section]);
  }

  async save() {
    if (!this.settings.dirty()) {
      this.lyt.notify({ kind: "Info", message: "No unsaved settings" });
      return;
    }
    try {
      await this.settings.save();
      this.lyt.notify({ kind: "Success", message: "Settings saved" });
    } catch (err) {
      this.lyt.notify({ kind: "Error", message: `Could not save settings: ${err}` });
    }
  }

  private _switchTo(section: SettingsSection) {
    this.activeSection.set(section);
    this.lyt.setSubGrid(settingsSubGrids[section], settingsSectionIds[section]);
  }
}
