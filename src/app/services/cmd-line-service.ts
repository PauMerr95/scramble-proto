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
    // Import a FASTA file from disk into the sequence store.
    e: async (path) => {
      this.lyt.focusOn("MainPane");
      if (!path) {
        this.report("Failure", "Usage: :e <path to fasta file>");
        return;
      }
      this.report("Neutral", `Importing ${path} ...`);
      try {
        const imported = await this.data.importFasta(path.replace(/^["']|["']$/g, ''));
        const bases = imported.reduce((sum, rec) => sum + rec.length, 0);
        this.report("Success", `Imported ${imported.length} record(s), ${bases} bases`);
      } catch (err) {
        this.report("Failure", `Import failed: ${err}`);
      }
    },
    // Write pending edits of the active record now instead of waiting for the background flush.
    w: async () => {
      this.lyt.focusOn("MainPane");
      try {
        const written = await this.sqv.save();
        this.report("Success", written ? "Written to disk" : "Nothing to write");
      } catch (err) {
        this.report("Failure", `Write failed: ${err}`);
      }
    }
  };
}
