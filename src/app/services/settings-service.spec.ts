import { TestBed } from '@angular/core/testing';
import { clearMocks, mockIPC } from '@tauri-apps/api/mocks';
import { SettingsService } from './settings-service';
import { ApiKeyStatus, SettingsInfo } from '../types/data_types';

const stored: SettingsInfo = {
  theme: "Ocean",
  workDir: "C:/scramble/work",
  lastSessionPath: null,
  configPath: "C:/scramble/.config.toml",
  apiKey: { available: false, source: null, updatedAt: null },
};
const keyed: ApiKeyStatus = { available: true, source: "Config", updatedAt: "2026-10-27T10:00:00Z" };

// Pins command names and argument shapes. The other half of this contract is
// src-tauri/tests/ipc.rs (settings_save_and_api_key_over_ipc).
describe('SettingsService', () => {
  let service: SettingsService;
  let calls: [string, unknown][];

  beforeEach(() => {
    calls = [];
    mockIPC((cmd, args) => {
      calls.push([cmd, args]);
      switch (cmd) {
        case 'get_settings':  return stored;
        case 'save_settings': return { ...stored, ...(args as { draft: object }).draft };
        case 'set_api_key':   return keyed;
        case 'clear_api_key': return stored.apiKey;
      }
      return null;
    });
    TestBed.configureTestingModule({});
    service = TestBed.inject(SettingsService);
  });

  afterEach(() => clearMocks());

  it('loads the settings and starts with a clean draft', async () => {
    await service.init();
    expect(service.saved()).toEqual(stored);
    expect(service.draftTheme()).toBe("Ocean");
    expect(service.draftWorkDir()).toBe("C:/scramble/work");
    expect(service.dirty()).toBe(false);
  });

  it('keeps defaults when the backend is unavailable', async () => {
    mockIPC(() => { throw 'no backend'; });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await service.init();
    expect(service.saved().theme).toBe("DarkLime");
  });

  it('tracks dirty sections and reverts the draft', async () => {
    await service.init();
    service.draftTheme.set("Doom");
    expect([...service.dirtySections()]).toEqual(["Appearance"]);
    service.draftWorkDir.set("C:/elsewhere");
    expect(service.dirtySections()).toEqual(new Set(["Appearance", "Scramble"]));

    service.revert();
    expect(service.dirty()).toBe(false);
  });

  it('saves the draft and adopts what the backend stored', async () => {
    await service.init();
    service.draftTheme.set("Doom");
    service.draftWorkDir.set("  C:/elsewhere ");
    await service.save();
    expect(calls.at(-1)).toEqual(['save_settings',
      { draft: { theme: "Doom", workDir: "C:/elsewhere", lastSessionPath: null } }]);
    expect(service.saved().theme).toBe("Doom");
    expect(service.dirty()).toBe(false);
  });

  it('keeps the draft when saving fails', async () => {
    await service.init();
    service.draftWorkDir.set("relative");
    mockIPC(() => { throw 'Work folder must be an absolute path: relative'; });
    await expect(service.save()).rejects.toContain('absolute');
    expect(service.draftWorkDir()).toBe("relative");
    expect(service.dirty()).toBe(true);
  });

  it('sets and clears the API key without keeping it', async () => {
    await service.init();
    service.draftTheme.set("Doom");
    await service.setApiKey("secret-key");
    expect(calls.at(-1)).toEqual(['set_api_key', { key: "secret-key" }]);
    expect(service.saved().apiKey).toEqual(keyed);
    expect(JSON.stringify(service.saved())).not.toContain("secret-key");
    // Key changes don't touch the draft.
    expect(service.draftTheme()).toBe("Doom");

    await service.clearApiKey();
    expect(calls.at(-1)?.[0]).toBe('clear_api_key');
    expect(service.saved().apiKey.available).toBe(false);
  });
});
