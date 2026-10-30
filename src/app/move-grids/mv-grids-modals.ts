import { MoveGrid, SelectableLocation } from "../types/layout_types";
import { SettingsSection } from "../types/layout_types";

// Settings: a layered grid (LayoutService.loadLayeredGrid). The base is the section list plus
// Save; the active section's sub-grid is merged to its right. Keep sub-grids at most as tall
// as the base.
export const settingsBaseGrid: MoveGrid = [
    ["SettingsSecScramble"],
    ["SettingsSecAppearance"],
    ["SettingsSecNcbi"],
    ["SettingsBtnSave"],
];
export const settingsSectionIds: Record<SettingsSection, SelectableLocation> = {
    Scramble:   "SettingsSecScramble",
    Appearance: "SettingsSecAppearance",
    NCBI:       "SettingsSecNcbi",
};
export const settingsSubGrids: Record<SettingsSection, MoveGrid> = {
    Scramble: [
        ["SettingsConfigPath"],
        ["SettingsInputWorkDir"],
    ],
    Appearance: [
        ["SettingsDDThemes"],
    ],
    NCBI: [
        ["SettingsKeyStatus"],
        ["SettingsInputApiKey"],
        ["SettingsBtnSetKey", "SettingsBtnClearKey"],
    ],
};

export const queryMainGrid: MoveGrid = [
["IconQueryGenome", "IconQueryGene", "IconQueryProkaryot", "IconQueryVirus", "IconQueryOrganelle"],
["TestButton1"]
];
export const queryGenomeGrid: MoveGrid = [
["IconQueryGenome", "IconQueryGene", "IconQueryProkaryot", "IconQueryVirus", "IconQueryOrganelle"],
["QueryDDGenomeOption1"]
];
export const queryGeneGrid: MoveGrid = [
["IconQueryGenome", "IconQueryGene", "IconQueryProkaryot", "IconQueryVirus", "IconQueryOrganelle"],
["RetrieveGeneBtn"]
];
export const queryProkaryotGrid: MoveGrid = [
["IconQueryGenome", "IconQueryGene", "IconQueryProkaryot", "IconQueryVirus", "IconQueryOrganelle"],
["RetrieveProkaryotBtn"]
];
export const queryVirusGrid: MoveGrid = [
["IconQueryGenome", "IconQueryGene", "IconQueryProkaryot", "IconQueryVirus", "IconQueryOrganelle"],
["RetrieveVirusBtn"]
];
export const queryOrganelleGrid: MoveGrid = [
["IconQueryGenome", "IconQueryGene", "IconQueryProkaryot", "IconQueryVirus", "IconQueryOrganelle"],
["RetrieveOrganelleBtn"]
];
