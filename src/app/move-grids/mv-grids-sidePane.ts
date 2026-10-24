import { MoveGrid } from "../types/side_types";

export const profileGrid: MoveGrid = [
    ["ProfileAvatar"],
    ["ProfileName"],
    ["ProfileBio"],
    ["ProfileKey"],
    ["ProfilePath"],
    ["ProfileDDThemes"],
    ["ProfileBtnSave"]
];
export type modeGridLoad = "SKIP" | "UNLOAD" | "LOAD";

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




