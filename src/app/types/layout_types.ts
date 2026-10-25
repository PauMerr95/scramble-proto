import { CursorPos } from "./main_types";
import { SelectableLocation } from "./side_types";
import { dropDownIDs } from "./util_types";


export const themes = ["DarkLime", "Ocean", "Catpuccin", "Material", "Swagger", "LightBlue", "LightRed", "LightGreen", "Scramble", "HolyLight", "Vampire", "Doom", "Vanilla", "Tropical"] as const;
export type Theme = typeof themes[number];

export const navbarLocations = ["Profile", "Files", "Query"] as const;
export type NavbarLocation = typeof navbarLocations[number];

// Navbar panels open as modals; the rest are opened from inside another modal.
export const modalTitles = [ ...navbarLocations, "AvatarMenu" ] as const;
export type ModalTitle = typeof modalTitles[number];

export const focusLocations = ["MainPane", "Navbar", "CmdModal", "Modal", "InputElement"] as const;
export type FocusLocation = typeof focusLocations[number];

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
    Profile:    { header: "Profile",       route: "modal/profile" },
    Files:      { header: "Files",         route: "modal/files" },
    Query:      { header: "NCBI Query",    route: "modal/query" },
    AvatarMenu: { header: "Choose Avatar", route: "modal/avatars" },
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

