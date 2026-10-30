import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { SettingsNcbi } from './settings-ncbi';
import { SettingsService } from '../../../../../services/settings-service';
import { LayoutService } from '../../../../../services/layout-service';
import { ApiKeyStatus, defaultSettingsInfo, SettingsInfo } from '../../../../../types/data_types';

describe('SettingsNcbi', () => {
  let component: SettingsNcbi;
  let fixture: ComponentFixture<SettingsNcbi>;
  let lyt: LayoutService;
  let saved: ReturnType<typeof signal<SettingsInfo>>;
  let fake: { saved: typeof saved, setApiKey: ReturnType<typeof vi.fn>, clearApiKey: ReturnType<typeof vi.fn> };

  const withKey = (apiKey: ApiKeyStatus) => saved.set({ ...defaultSettingsInfo(), apiKey });

  beforeEach(async () => {
    saved = signal(defaultSettingsInfo());
    fake = { saved, setApiKey: vi.fn().mockResolvedValue(undefined), clearApiKey: vi.fn().mockResolvedValue(undefined) };
    await TestBed.configureTestingModule({
      imports: [SettingsNcbi],
      providers: [{ provide: SettingsService, useValue: fake }],
    }).compileComponents();
    lyt = TestBed.inject(LayoutService);
    fixture = TestBed.createComponent(SettingsNcbi);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  const status = (): string => fixture.nativeElement.querySelector('.info-segment-value').textContent;

  it('shows the key status without the key', async () => {
    expect(status()).toContain("NOT AVAILABLE");
    withKey({ available: true, source: "Env", updatedAt: null });
    await fixture.whenStable();
    expect(status()).toContain("from NCBI_API_KEY");
    withKey({ available: true, source: "Config", updatedAt: "2026-10-27T10:00:00Z" });
    await fixture.whenStable();
    expect(status()).toContain("updated");
    expect(fixture.nativeElement.querySelector('input').type).toBe("password");
  });

  it('sets a trimmed key and clears the input', async () => {
    component.keyInput().inputValueControl.setValue("  secret-key ");
    await component.setKey();
    expect(fake.setApiKey).toHaveBeenCalledWith("secret-key");
    expect(component.keyInput().inputValueControl.value).toBe(null);
    expect(lyt.activeNotifications().at(-1)?.kind).toBe("Success");
  });

  it('warns on an empty key and keeps a rejected one in the input', async () => {
    await component.setKey();
    expect(fake.setApiKey).not.toHaveBeenCalled();
    expect(lyt.activeNotifications().at(-1)?.kind).toBe("Warn");

    fake.setApiKey.mockRejectedValue("disk full");
    component.keyInput().inputValueControl.setValue("k");
    await component.setKey();
    expect(component.keyInput().inputValueControl.value).toBe("k");
    expect(lyt.activeNotifications().at(-1)?.kind).toBe("Error");
  });

  it('only removes a key stored in the settings', async () => {
    withKey({ available: true, source: "Env", updatedAt: null });
    await component.clearKey();
    expect(fake.clearApiKey).not.toHaveBeenCalled();

    withKey({ available: true, source: "Config", updatedAt: null });
    await component.clearKey();
    expect(fake.clearApiKey).toHaveBeenCalledOnce();
  });
});
