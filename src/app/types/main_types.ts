export type sequence = string;
export type rows = string[];
export type EditorMode = "Normal" | "Visual" | "Insert" | "Replace";
export type RGB = `rgb(${number}, ${number}, ${number})`
export type RGBA = `rgb(${number}, ${number}, ${number}, ${number})`
export type HEX = `#${string}`
export type Color = RGB | RGBA | HEX;
export type Result = "Pass" | "Fail";
export type FilePath = string | null;

export interface CursorPos {
    row: number;
    col: number;
    offset: number;
}

export interface SearchResult {
    status: Result;
    value: CursorPos[];
}

export interface VisualSelection {
    anchorOffset: number;
    activeOffset: number;
}
// Mirrors `RecordMeta` in src-tauri/src/seq/fasta.rs. The sequence itself stays on disk.
export interface RecordMeta {
    id: string;
    header: string;
    comments: string[];
    length: number;
    source: string | null;
}

// Mirrors `EditOp` in src-tauri/src/seq/view.rs. Offsets are 0-based base positions.
export type EditOp =
    | { kind: "insert";  offset: number; bases: string }
    | { kind: "delete";  offset: number; len: number }
    | { kind: "replace"; offset: number; bases: string };

// Mirrors `IUPAC` in src-tauri/src/seq.rs: nucleotide codes incl. U plus gap symbols.
export const IUPAC_CODES = "ACGTURYSWKMBDHVN-.";
