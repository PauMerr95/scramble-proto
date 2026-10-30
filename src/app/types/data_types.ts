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

// === NCBI queries ===
export interface QueryPacket {
  how:  SelectableQueryBy,
  what: SelectableRetrieve,
  specifier: string,
}

export const GENOME_QUERY_OPTS = [
  "Assembly Accession",
  "Nucleotide Accession",
  "Assembly Name",
  "BioProject Accession",
  "BioSample Accession",
  "Species Taxon",
  "WGS Accession"
] as const;
export type SelectableQueryBy = typeof GENOME_QUERY_OPTS[number];

export const RETRIEVE_OPTS = [
  "Annotation Report",
  "Annotation Data Package",
  "Annotation Download Summary",
  "Annotation Report Summary",
  "Revision History",
  "Sequence Report",
  "Assembly Report",
  "Data Package",
  "Download Summary",
  "Assembly Accession",
  "CheckM Histogramm"
] as const;
export type SelectableRetrieve = typeof RETRIEVE_OPTS[number];

// Which retrieve options work with which query-by option.
export interface RetrieveRosterItem {
  value: SelectableRetrieve,
  compatibleWith: SelectableQueryBy[],
}
export type RetrieveRoster = RetrieveRosterItem[];
