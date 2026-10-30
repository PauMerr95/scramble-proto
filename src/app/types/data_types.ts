import { Theme } from '../types/layout_types';

// Mirrors `ApiKeySource` in src-tauri/src/user/data.rs
export type ApiKeySource = "Config" | "Env";

// Mirrors `ApiKeyStatus` in src-tauri/src/user/data.rs. The key itself never reaches the frontend.
export interface ApiKeyStatus {
  available: boolean,
  source: ApiKeySource | null,
  updatedAt: string | null,
}

// Mirrors `SettingsInfo` in src-tauri/src/user/data.rs
export interface SettingsInfo {
  theme: Theme,
  workDir: string,
  lastSessionPath: string | null,
  configPath: string,
  apiKey: ApiKeyStatus,
}

// Mirrors `SettingsDraft` in src-tauri/src/user/data.rs (what the Save button sends)
export interface SettingsDraft {
  theme: Theme,
  workDir: string,
  lastSessionPath: string | null,
}

export function defaultSettingsInfo(): SettingsInfo {
  return {
    theme: "DarkLime",
    workDir: "",
    lastSessionPath: null,
    configPath: "",
    apiKey: { available: false, source: null, updatedAt: null },
  }
}
