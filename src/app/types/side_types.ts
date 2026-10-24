import { ButtonID, DropDownID, InputID } from "./util_types";
export const avatars = ["Bird", "Duck", "Earth", "Falling", "Sheep", "Squirrel"]
export type Avatar = typeof avatars[number];

export interface QueryPacket {
  how:  SelectectableQueryBy,
  what: SelectectableRetrieve,
  specifier: string,
}

export const selectableLocations: string[] = [
    // -- PROFILE --
    "ProfileAvatar", "ProfileName", "ProfileBio", "ProfileKey", "ProfilePath",
    // -- FILES --
    "FileItem",
    // -- QUERY --
    "IconQueryGenome", "IconQueryGene", "IconQueryProkaryot", "IconQueryVirus", "IconQueryOrganelle",
]
export type SelectableLocation = typeof selectableLocations[number] | Avatar | ButtonID | DropDownID | InputID;

export const GENOME_QUERY_OPTS = [
    "Assembly Accession",
    "Nucleotide Accession",
    "Assembly Name",
    "BioProject Accession",
    "BioSample Accession",
    "Species Taxon",
    "WGS Accession"
] as const;
export type SelectectableQueryBy = typeof GENOME_QUERY_OPTS[number];

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
];
export type SelectectableRetrieve = typeof RETRIEVE_OPTS[number];

interface RetrieveRosterItem {
    value: SelectectableRetrieve, compatibleWith: SelectectableQueryBy[]
}
export interface RetrieveRoster extends Array<RetrieveRosterItem>{}
export type MoveGrid = SelectableLocation[][];
