import { Theme } from "./layout_types";
import { SelectableQueryBy, SelectableRetrieve } from "./data_types";

export const buttonIDs = [
    "TestButton1",

    // === Query Buttons ===
    "RetrieveGenomeBtn", "RetrieveGeneBtn", "RetrieveProkaryotBtn",
    "RetrieveVirusBtn", "RetrieveOrganelleBtn",
    // === Settings Buttons ===
    "SettingsBtnSave", "SettingsBtnSetKey", "SettingsBtnClearKey"
] as const;
export const dropDownIDs = [
    // === Settings DDs ===
    "SettingsDDThemes",
    // === Query DDs ===
    "QueryDDGenomeOption1",
    "QueryDDGenomeOption2"
] as const;

export const inputIDs = [
  // === Query Inputs ===
  "QueryInputGenome",
  // === Settings Inputs ===
  "SettingsInputWorkDir", "SettingsInputApiKey"
] as const;

export type ButtonID = typeof buttonIDs[number];
export type DropDownID = typeof dropDownIDs[number];
export type InputID = typeof inputIDs[number];

export type DropDownOption = Theme | SelectableQueryBy | SelectableRetrieve;

