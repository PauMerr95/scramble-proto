import { Injectable, signal, computed, inject } from '@angular/core';
import { CmdInputType, CmdOutcome, CmdHint, Command, ExCommandEntry } from '../types/cmd_types';
import { FocusLocation } from '../types/layout_types';
import { SequenceViewerService, SEARCH_LIMIT } from './sequence-viewer-service';
import { LayoutService } from './layout-service';
import { DataSessionService } from './data-session-service';
import { PaneService } from './pane-service';

export const HISTORY_LIMIT = 50;
export const LEADER_TIMEOUT_MS = 5000;

type HistoryMode = "Command" | "Search";

/**
 * Drives the cmd modal: ':' ex-commands, '/' search and the space leader.
 * Results are reported through LayoutService notifications.
 */
@Injectable({
  providedIn: 'root',
})
export class CmdLineService {
  private readonly lyt   = inject(LayoutService);
  private readonly data  = inject(DataSessionService);
  private readonly panes = inject(PaneService);

  /** Commands act on the viewer of the active pane. */
  private get sqv(): SequenceViewerService { return this.panes.activeViewer(); }

  private readonly _mode  = signal<CmdInputType | null>(null);
  private readonly _input = signal<string>('');

  // Digits typed after the leader, e.g. the 12 of <leader>12t.
  private readonly _leaderCount = signal<string>('');

  readonly mode     = this._mode.asReadonly();
  readonly cmdInput = this._input.asReadonly();
  readonly leaderCount = this._leaderCount.asReadonly();

  /** Ex-commands matching the typed name; once args follow, only the exact command. */
  readonly hints = computed<CmdHint[]>(() => {
    if (this._mode() !== "Command") return [];
    const [name, ...args] = this._input().trimStart().split(/\s+/);
    const matches = (args.length > 0)
      ? (key: string) => key === name
      : (key: string) => key.startsWith(name);
    return Object.entries(this.executeCmds)
      .filter(([key]) => matches(key))
      .map(([key, cmd]) => ({ key, usage: cmd.usage, description: cmd.description }));
  });

  private _returnFocus: FocusLocation | null = null;
  private _leaderTimeout: ReturnType<typeof setTimeout> | undefined = undefined;

  private readonly _history: Record<HistoryMode, string[]> = { Command: [], Search: [] };
  private _historyIdx: number | null = null;
  private _historyDraft = '';

  // === OPEN / CLOSE ===
  open(mode: CmdInputType) {
    if (this._mode() === null) this._returnFocus = this.lyt.currentFocus();
    this._mode.set(mode);
    this._input.set('');
    this._leaderCount.set('');
    this._historyIdx = null;
    clearTimeout(this._leaderTimeout);
    if (mode === "Leader") {
      this._leaderTimeout = setTimeout(() => this.close(), LEADER_TIMEOUT_MS);
    }
    this.lyt.focusOn("CmdModal");
  }

  close() {
    if (this._mode() === null) return;
    clearTimeout(this._leaderTimeout);
    this._mode.set(null);
    this._input.set('');
    this._leaderCount.set('');
    this._historyIdx = null;
    this.lyt.focusOn(this._returnFocus ?? "MainPane");
    this._returnFocus = null;
  }

  setInput(text: string) {
    this._input.set(text);
  }

  // === SUBMIT ===
  /** Closes the modal, then runs the input. Resolves once the command has reported. */
  async submit(): Promise<void> {
    const mode = this._mode();
    const text = this._input().trim();
    this.close();
    if (!text || mode === "Leader" || mode === null) return;
    this._remember(mode, text);
    switch (mode) {
      case "Search":  await this._runSearch(text); break;
      case "Command": await this._runCommand(text); break;
    }
  }

  /** A key pressed after the leader. The leader has no overlay. Digits wait for a counted key. */
  pressLeader(key: string) {
    if (/^\d$/.test(key)) {
      this._leaderCount.update(count => count + key);
      return;
    }
    const count = this._leaderCount();
    const cmd = this.leaderCmds[key];
    this.close();
    if (count) {
      if (key === 't') this.openTab(Number(count));
      else this._report("Failure", `No leader mapping for '${count}${key}'`);
      return;
    }
    if (!cmd) {
      this._report("Failure", `No leader mapping for '${key}'`);
      return;
    }
    cmd();
  }

  // === TABS ===
  /** Shows tab `number` (1-based, one per record) in the active pane. */
  openTab(number: number) {
    const idx = number - 1;
    if (!this.data.records()[idx]) {
      this._report("Failure", `There is no tab ${number}`);
      return;
    }
    this.sqv.selectRecord(idx);
  }

  /** The tab's close button: like :q, but for the file of tab `number`. */
  async closeTab(number: number): Promise<void> {
    const rec = this.data.records()[number - 1];
    if (rec) await this._close(false, rec);
  }

  // === HISTORY ===
  historyPrev() {
    const history = this._currentHistory();
    if (!history?.length) return;
    if (this._historyIdx === null) {
      this._historyDraft = this._input();
      this._historyIdx = history.length;
    }
    this._historyIdx = Math.max(0, this._historyIdx - 1);
    this._input.set(history[this._historyIdx]);
  }

  historyNext() {
    const history = this._currentHistory();
    if (!history || this._historyIdx === null) return;
    this._historyIdx++;
    if (this._historyIdx >= history.length) {
      this._historyIdx = null;
      this._input.set(this._historyDraft);
      return;
    }
    this._input.set(history[this._historyIdx]);
  }

  // === COMPLETION ===
  /** Completes the command name to the longest common prefix of all matches. */
  complete() {
    if (this._mode() !== "Command") return;
    const typed = this._input().trimStart();
    if (/\s/.test(typed)) return;
    const matches = Object.keys(this.executeCmds).filter(key => key.startsWith(typed));
    if (matches.length === 0) return;
    if (matches.length === 1) {
      this._input.set(matches[0] + ' ');
      return;
    }
    this._input.set(commonPrefix(matches));
  }

  // === PRIVATE ===
  private _currentHistory(): string[] | null {
    const mode = this._mode();
    return (mode === "Command" || mode === "Search") ? this._history[mode] : null;
  }

  private _remember(mode: HistoryMode, text: string) {
    const history = this._history[mode];
    if (history[history.length - 1] === text) return;
    history.push(text);
    if (history.length > HISTORY_LIMIT) history.shift();
  }

  private async _runSearch(query: string): Promise<CmdOutcome> {
    let found = 0;
    try {
      found = await this.sqv.search(query);
    } catch (err) {
      return this._report("Failure", `Search failed: ${err}`);
    }
    if (!found) {
      return this._report("Failure", `'${query}' could not be found in the active sequence`);
    }
    const capped = (found >= SEARCH_LIMIT) ? ` (showing the first ${SEARCH_LIMIT})` : '';
    return this._report("Success", `Found ${found} instances of '${query}'${capped} - n/N to jump`);
  }

  private async _runCommand(text: string): Promise<void> {
    // "e some/file.fasta" -> name "e", args "some/file.fasta"
    const [name, ...rest] = text.split(/\s+/);
    const args = rest.join(' ').trim();
    const cmd = this.executeCmds[name];
    if (!cmd) {
      this._report("Failure", `Could not find any commands called ${name}`);
      return;
    }
    await cmd.run(args);
  }

  private _report(kind: CmdOutcome, message: string): CmdOutcome {
    this.lyt.notify({ kind: (kind === "Success") ? "Success" : "Error", message });
    return kind;
  }

  private readonly leaderCmds: Record<string, Command> = {
    s: () => this.lyt.toggleModal("Settings"),
    f: () => this.lyt.toggleModal("Files"),
    d: () => this.lyt.toggleModal("Query"),
    n: () => this.lyt.dismissNotification(this.lyt.activeNotifications()[0]?.id),
    a: () => this.panes.toggleAnnotation(),
    q: () => this.panes.remove(),
  };

  private readonly executeCmds: Record<string, ExCommandEntry> = {
    // Open a FASTA/FNA file as a working copy; :w writes it back.
    e: {
      usage: "e <path>", description: "Open a FASTA/FNA file",
      run: (path) => this._open(path),
    },
    w: {
      usage: "w [path]", description: "Write the active file, or save it as <path>",
      run: async (path) => { await this._write(path, false); },
    },
    "w!": {
      usage: "w! [path]", description: "Write even if the source changed on disk",
      run: async (path) => { await this._write(path, true); },
    },
    // :q! discards unsaved changes.
    q: {
      usage: "q", description: "Close the active file",
      run: async () => { await this._close(false); },
    },
    "q!": {
      usage: "q!", description: "Close the active file, discarding changes",
      run: async () => { await this._close(true); },
    },
    wq: {
      usage: "wq [path]", description: "Write, then close the active file",
      run: async (path) => { if (await this._write(path, false)) await this._close(false); },
    },
    // Panes: :pd keeps the file open, :pq closes it too (in the last pane only the file).
    pd: {
      usage: "pd", description: "Remove the active pane, keep its file open",
      run: () => { this.panes.remove(); },
    },
    pq: {
      usage: "pq", description: "Close the active file and its pane",
      run: () => this._closePane(false),
    },
    "pq!": {
      usage: "pq!", description: "Close the active file and its pane, discarding changes",
      run: () => this._closePane(true),
    },
    tab: {
      usage: "tab <number>", description: "Show tab <number> in the active pane",
      run: (number) => {
        if (!/^\d+$/.test(number)) this._report("Failure", "Usage: :tab <number>");
        else this.openTab(Number(number));
      },
    },
    toggleAnnotation: {
      usage: "toggleAnnotation", description: "Show or hide the annotation overlay",
      run: () => this.panes.toggleAnnotation(),
    },
    set: {
      usage: "set", description: "Open settings",
      run: () => { if (this.lyt.modalRoot() !== "Settings") this.lyt.toggleModal("Settings"); },
    },
    getJoke: {
      usage: "getJoke", description: "Tell a joke",
      run: () => { this._report("Success", "I can't C# without my glasses."); },
    },
  };

  private async _open(path: string): Promise<void> {
    if (!path) {
      this._report("Failure", "Usage: :e <path to fasta file>");
      return;
    }
    const known = new Set(this.data.records().map(rec => rec.id));
    try {
      const opened = await this.data.openFasta(unquote(path));
      if (opened.every(rec => known.has(rec.id))) {
        this.sqv.selectRecord(this.data.records().findIndex(rec => rec.id === opened[0]?.id));
        this._report("Success", `${path} is already open`);
        return;
      }
      const bases = opened.reduce((sum, rec) => sum + rec.length, 0);
      this._report("Success", `Opened ${opened.length} record(s), ${bases} bases`);
    } catch (err) {
      this._report("Failure", `Open failed: ${err}`);
    }
  }

  /** Returns whether the file was written. */
  private async _write(path: string, force: boolean): Promise<boolean> {
    if (!this.sqv.activeRecord()) {
      this._report("Failure", "No open file to write");
      return false;
    }
    try {
      const saved = await this.sqv.save(path ? unquote(path) : null, force);
      this._report("Success", `Written to ${saved}`);
      return true;
    } catch (err) {
      this._report("Failure", `Write failed: ${err}`);
      return false;
    }
  }

  /** Returns whether the file was closed. */
  private async _close(force: boolean, rec = this.sqv.activeRecord()): Promise<boolean> {
    if (!rec) {
      this._report("Failure", "No open file to close");
      return false;
    }
    try {
      const closed = await this.sqv.close(force, rec);
      this._report("Success", `Closed ${closed}`);
      return true;
    } catch (err) {
      this._report("Failure", `Close failed: ${err}`);
      return false;
    }
  }

  private async _closePane(force: boolean): Promise<void> {
    const closed = await this._close(force);
    if (closed && this.panes.count() > 1) this.panes.remove();
  }
}

function unquote(path: string): string {
  return path.replace(/^["']|["']$/g, '');
}

function commonPrefix(words: string[]): string {
  let prefix = words[0];
  for (const word of words) {
    while (!word.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  return prefix;
}
