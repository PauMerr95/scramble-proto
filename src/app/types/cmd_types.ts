export type CmdInputType = "Search" | "Command" | "Leader";
export type CmdOutcome = "Success" | "Failure";
export type Command = () => void;
export type ExCommand = (args: string) => void | Promise<void>;

export interface ExCommandEntry {
  usage: string;
  description: string;
  run: ExCommand;
}

/** One line in the cmd modal's hint list. */
export interface CmdHint {
  key: string;
  usage: string;
  description: string;
}
