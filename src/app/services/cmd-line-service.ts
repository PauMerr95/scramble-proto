import { Injectable, signal, ElementRef } from '@angular/core';
import { CmdInputType, CmdOutputType, Command, ExCommand } from '../types/cmd_types';
import { SequenceViewerService, SEARCH_LIMIT } from './sequence-viewer-service';
import { LayoutService } from './layout-service';
import { DataSessionService } from './data-session-service';

@Injectable({
  providedIn: 'root',
})
export class CmdLineService {
  constructor(
    private lyt: LayoutService,
    private sqv: SequenceViewerService,
    private data: DataSessionService) {}


  readonly cmdInput = signal<string>('');
  readonly cmdInputType = signal<CmdInputType | null>(null);

  readonly cmdOutput = signal<string>("Scramble booted up successfully");
  readonly cmdOutputType = signal<CmdOutputType>("Neutral");

  handleInput(mode: CmdInputType) {
    if (!mode) return;
    this.cmdInputType.set(mode);
    if (mode === "Leader") {
      this.leaderTimeout = setTimeout(() => this.abort(), 5000);
    }
  }

  runInput() {
    switch(this.cmdInputType()) {
      case "Search":  this.checkSearch(); break;
      case "Command": this.checkCommand(); break;
      case "Leader":  this.checkLeader(); break;
      default: this.lyt.notify({kind: "Error", message: "Failed to assign Input to InputType (Search, Command, Leader)"})
    }
  }

  async checkSearch(): Promise<CmdOutputType> {
    const query = this.cmdInput();
    this.cmdInput.set('');
    this.cmdInputType.set(null);

    let found = 0;
    try {
      found = await this.sqv.search(query);
    } catch (err) {
      return this.report("Failure", `Search failed: ${err}`);
    }
    if (!found) {
      return this.report("Failure", `'${query}' could not be found in the active sequence`);
    }
    const capped = (found >= SEARCH_LIMIT) ? ` (showing the first ${SEARCH_LIMIT})` : '';
    return this.report("Success", `Found ${found} instances of '${query}'${capped} - n/N to jump`);
  }

  checkCommand(): CmdOutputType{
    // ":e some/file.fasta" -> name "e", args ["some/file.fasta"]
    const [name, ...rest] = this.cmdInput().trim().split(/\s+/);
    const args = rest.join(' ').trim();
    const cmd = this.executeCmds[name];
    this.cmdInput.set('');
    this.cmdInputType.set(null);
    if(cmd){
      cmd(args);
      return "Success";
    } else {
      return this.report("Failure", `Could not find any commands called ${name}`);
    }
  }

  private report(kind: CmdOutputType, message: string): CmdOutputType {
    this.cmdOutputType.set(kind);
    this.cmdOutput.set(message);
    return kind;
  }

  checkLeader(): CmdOutputType {
    const cmd = this.leaderCmds[this.cmdInput()];
    if(cmd){
      clearTimeout(this.leaderTimeout);
      cmd();
      this.cmdInput.set('');
      this.cmdInputType.set(null);
      return "Success";
    }
    return "Failure";
  }

  abort(){
    if (this.leaderTimeout) clearTimeout(this.leaderTimeout);
    this.cmdInput.set('');
    this.cmdInputType.set(null);
    this.lyt.focusOn("MainPane");
  }

  private leaderTimeout: ReturnType<typeof setTimeout> | undefined = undefined;

  private readonly leaderCmds: Record<string, Command> = {
    p: () => this.lyt.toggleSidePane("Profile"),
    f: () => this.lyt.toggleSidePane("Files"),
    q: () => this.lyt.toggleSidePane("Query"),
    n: () => {
      this.lyt.dismissNotification(this.lyt.activeNotifications()[0]?.id)
      this.lyt.focusOn("MainPane");
    }
  };
  private readonly executeCmds: Record<string, ExCommand> = {
    getJoke: () => {
      this.cmdOutput.set("I can't C# without my glasses.");
      this.cmdOutputType.set("Success");
      this.lyt.focusOn("MainPane");
    },
    // Open a FASTA/FNA file as a working copy; :w writes it back.
    e: async (path) => {
      this.lyt.focusOn("MainPane");
      if (!path) {
        this.report("Failure", "Usage: :e <path to fasta file>");
        return;
      }
      this.report("Neutral", `Opening ${path} ...`);
      const known = new Set(this.data.records().map(rec => rec.id));
      try {
        const opened = await this.data.openFasta(unquote(path));
        if (opened.every(rec => known.has(rec.id))) {
          this.sqv.selectRecord(this.data.records().findIndex(rec => rec.id === opened[0]?.id));
          this.report("Success", `${path} is already open`);
          return;
        }
        const bases = opened.reduce((sum, rec) => sum + rec.length, 0);
        this.report("Success", `Opened ${opened.length} record(s), ${bases} bases`);
      } catch (err) {
        this.report("Failure", `Open failed: ${err}`);
      }
    },
    // Write the active file back to its source, or save it as <path>. :w! overwrites anyway.
    w:    async (path) => { await this.write(path, false); },
    "w!": async (path) => { await this.write(path, true); },
    // Close the active file. :q! discards unsaved changes.
    q:    () => this.close(false),
    "q!": () => this.close(true),
    wq: async (path) => {
      if (await this.write(path, false)) await this.close(false);
    },
  };

  /** Returns whether the file was written. */
  private async write(path: string, force: boolean): Promise<boolean> {
    this.lyt.focusOn("MainPane");
    if (!this.sqv.activeRecord()) {
      this.report("Failure", "No open file to write");
      return false;
    }
    try {
      const saved = await this.sqv.save(path ? unquote(path) : null, force);
      this.report("Success", `Written to ${saved}`);
      return true;
    } catch (err) {
      this.report("Failure", `Write failed: ${err}`);
      return false;
    }
  }

  private async close(force: boolean): Promise<void> {
    this.lyt.focusOn("MainPane");
    if (!this.sqv.activeRecord()) {
      this.report("Failure", "No open file to close");
      return;
    }
    try {
      const closed = await this.sqv.close(force);
      this.report("Success", `Closed ${closed}`);
    } catch (err) {
      this.report("Failure", `Close failed: ${err}`);
    }
  }
}

function unquote(path: string): string {
  return path.replace(/^["']|["']$/g, '');
}
