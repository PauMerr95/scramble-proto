import { CursorPos } from "./main_types";
import { SelectableLocation } from "./side_types";
import { dropDownIDs } from "./util_types";

export const modalTitles = [ "AvatarMenu" ] as const;
export type ModalTitle = typeof modalTitles[number];

export const themes = ["DarkLime", "Ocean", "Catpuccin", "Material", "Swagger", "LightBlue", "LightRed", "LightGreen", "Scramble", "HolyLight", "Vampire", "Doom", "Vanilla", "Tropical"] as const;
export type Theme = typeof themes[number];

export const navbarLocations = ["Profile", "Files", "Query", "Hidden"] as const;
export type NavbarLocation = typeof navbarLocations[number];

export const focusLocations = ["MainPane", "Navbar", "SidePane", "CmdLine", "Modal", "InputElement"] as const;
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
    title: ModalTitle,
    route: string
}

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

