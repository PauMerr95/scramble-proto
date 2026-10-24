import { Theme } from "./layout_types";
import { SelectectableQueryBy, SelectectableRetrieve } from "./side_types";

export const buttonIDs = [
    "TestButton1",

    // === Query Buttons ===
    "RetrieveGenomeBtn", "RetrieveGeneBtn", "RetrieveProkaryotBtn",
    "RetrieveVirusBtn", "RetrieveOrganelleBtn",
    // === Profile Buttons ===
    "ProfileBtnSave"
] as const;
export const dropDownIDs = [
    // === Profile DDs ===
    "ProfileDDThemes",
    // === Query DDs ===
    "QueryDDGenomeOption1",
    "QueryDDGenomeOption2"
] as const;

export const inputIDs = [
  // === Query Inputs ===
  "QueryInputGenome"
] as const;

export type ButtonID = typeof buttonIDs[number];
export type DropDownID = typeof dropDownIDs[number];
export type InputID = typeof inputIDs[number];

export type DropDownOption = Theme | SelectectableQueryBy | SelectectableRetrieve;

