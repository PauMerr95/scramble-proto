export type CmdInputType = "Search" | "Command" | "Leader";
export type CmdOutputType = "Neutral" | "Success" | "Failure";
export type HighlightArea = {begin: number; end: number};
export type Command = () => void;
export type ExCommand = (args: string) => void | Promise<void>;