import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Settings } from './settings';
import { LayoutService } from '../../../../services/layout-service';
import { SettingsService } from '../../../../services/settings-service';

describe('Settings', () => {
  let component: Settings;
  let fixture: ComponentFixture<Settings>;
  let lyt: LayoutService;
  let settings: SettingsService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Settings],
      providers: [provideRouter([{ path: '**', children: [] }])],
    }).compileComponents();
    lyt = TestBed.inject(LayoutService);
    settings = TestBed.inject(SettingsService);

    lyt.toggleModal("Settings");
    fixture = TestBed.createComponent(Settings);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  const sectionButton = (label: string): HTMLElement =>
    [...fixture.nativeElement.querySelectorAll('.settings-section')]
      .find((el: HTMLElement) => el.textContent!.includes(label));

  it('loads the section list with the first section merged in', () => {
    expect(lyt.currentlyTargeted()).toBe("SettingsSecScramble");
    expect(lyt.currentMoveGrid![0]).toStrictEqual(["SettingsSecScramble", "SettingsConfigPath"]);
    expect(fixture.nativeElement.querySelector('app-settings-scramble')).toBeTruthy();
  });

  it('switches the section as soon as the cursor lands on it', async () => {
    lyt.moveDown();
    TestBed.tick();
    await fixture.whenStable();
    expect(component.activeSection()).toBe("Appearance");
    expect(lyt.currentMoveGrid![0]).toStrictEqual(["SettingsSecScramble", "SettingsDDThemes"]);
    expect(fixture.nativeElement.querySelector('app-settings-appearance')).toBeTruthy();
    // h from the sub-grid comes back to the active section.
    lyt.moveRight();
    lyt.moveLeft();
    expect(lyt.currentlyTargeted()).toBe("SettingsSecAppearance");
  });

  it('switches the section on click', async () => {
    sectionButton("NCBI").click();
    TestBed.tick();
    await fixture.whenStable();
    expect(component.activeSection()).toBe("NCBI");
    expect(lyt.currentlyTargeted()).toBe("SettingsSecNcbi");
    expect(fixture.nativeElement.querySelector('app-settings-ncbi')).toBeTruthy();
  });

  it('marks sections with unsaved changes', async () => {
    expect(sectionButton("Appearance").textContent).not.toContain("●");
    settings.draftTheme.set("Doom");
    await fixture.whenStable();
    expect(sectionButton("Appearance").textContent).toContain("●");
    expect(sectionButton("Scramble").textContent).not.toContain("●");
  });

  it('reports instead of saving when nothing changed', async () => {
    const spySave = vi.spyOn(settings, 'save');
    await component.save();
    expect(spySave).not.toHaveBeenCalled();
    expect(lyt.activeNotifications().at(-1)?.message).toBe("No unsaved settings");
  });

  it('reports a failed save', async () => {
    settings.draftWorkDir.set("relative");
    vi.spyOn(settings, 'save').mockRejectedValue("Work folder must be an absolute path: relative");
    await component.save();
    expect(lyt.activeNotifications().at(-1)).toMatchObject({ kind: "Error" });
  });
});
