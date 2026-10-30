import { CursorPos } from "./main_types";
import { ButtonID, DropDownID, InputID, dropDownIDs } from "./util_types";


export const themes = ["DarkLime", "Ocean", "Catpuccin", "Material", "Swagger", "LightBlue", "LightRed", "LightGreen", "Scramble", "HolyLight", "Vampire", "Doom", "Vanilla", "Tropical"] as const;
export type Theme = typeof themes[number];

export const navbarLocations = ["Settings", "Files", "Query"] as const;
export type NavbarLocation = typeof navbarLocations[number];

// Navbar panels open as modals; sub-modals opened from inside another modal go here too.
export const modalTitles = [ ...navbarLocations ] as const;
export type ModalTitle = typeof modalTitles[number];

export const focusLocations = ["MainPane", "Navbar", "CmdModal", "Modal", "InputElement"] as const;
export type FocusLocation = typeof focusLocations[number];

export const settingsSections = ["Scramble", "Appearance", "NCBI"] as const;
export type SettingsSection = typeof settingsSections[number];

export const queryPages = ["Genome", "Gene", "Prokaryot", "Virus", "Organelle", "QueryMain"] as const;
export type QueryPage = typeof queryPages[number];

export const notificationTypes = ["Info", "Warn", "Error", "Success"] as const;
export type NotificationType = typeof notificationTypes[number];

export interface NotificationObject {
    kind: NotificationType,
    message: string
}
export type ActiveNotification = NotificationObject & { id: number };

export interface ModalObject {
    header: string,
    route: string
}

export const modals: Record<ModalTitle, ModalObject> = {
    Settings:   { header: "Settings",      route: "modal/settings" },
    Files:      { header: "Files",         route: "modal/files" },
    Query:      { header: "NCBI Query",    route: "modal/query" },
};

export const gridInjectors = [
  // == Drop Downs ==
  ...dropDownIDs,
] as const;

export type GridInjector = typeof gridInjectors[number];

export interface GridInjection {
  insertLoc: CursorPos,
  origin: GridInjector,
  axis: "col" | "row",
  data: SelectableLocation[];
}

export interface GridInjectorTracker {
  validInjection: GridInjector | null;
  injections: Map<GridInjector, GridInjection>;
};

// === Move grids ===
// Ids of everything a modal's move grid can target (see move-grids/mv-grids-modals.ts).
export const selectableLocations = [
    // -- SETTINGS --
    "SettingsSecScramble", "SettingsSecAppearance", "SettingsSecNcbi",
    "SettingsConfigPath", "SettingsKeyStatus",
    // -- FILES --
    "FileItem",
    // -- QUERY --
    "IconQueryGenome", "IconQueryGene", "IconQueryProkaryot", "IconQueryVirus", "IconQueryOrganelle",
] as const;
// An open drop down injects its options as "<index>_<drop down id>_<option>" (see checkDropDownOption).
export type DropDownOptionLocation = `${number}_${DropDownID}_${string}`;
export type SelectableLocation =
  typeof selectableLocations[number] | ButtonID | DropDownID | InputID | DropDownOptionLocation;
export type MoveGrid = SelectableLocation[][];
