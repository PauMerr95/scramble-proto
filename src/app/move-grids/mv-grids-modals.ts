import { avatars, MoveGrid } from "../types/side_types";

export const modalAvatarGrid: MoveGrid = 
    Array.from({length: Math.ceil(avatars.length/6)},
        (_, idx) => {
            return avatars.slice(idx*6, (idx+1)*6);
        });

export const profileGrid: MoveGrid = [
    ["ProfileAvatar"],
    ["ProfileName"],
    ["ProfileBio"],
    ["ProfileKey"],
    ["ProfilePath"],
    ["ProfileDDThemes"],
    ["ProfileBtnSave"]
];

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
