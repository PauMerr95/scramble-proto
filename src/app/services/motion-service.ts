import { inject, Injectable } from '@angular/core';
import { LayoutService } from './layout-service';
import { SequenceViewerService, LINE_WIDTH } from './sequence-viewer-service';
import { CmdLineService } from './cmd-line-service';
import { PaneService } from './pane-service';
import { IUPAC_CODES } from '../types/main_types';
import { PaneDirection } from '../types/pane_types';

// Alt+h/j/k/l by physical key: Alt changes e.key on some layouts (macOS: Alt+h is '˙').
const PANE_MOVES: Record<string, PaneDirection> = {
  KeyH: "Left", KeyJ: "Down", KeyK: "Up", KeyL: "Right",
};

@Injectable({
  providedIn: 'root',
})
export class MotionService {
  readonly lyt   = inject(LayoutService);
  readonly cli   = inject(CmdLineService);
  readonly panes = inject(PaneService);

  /** The viewer of the active pane. */
  get sqv(): SequenceViewerService { return this.panes.activeViewer(); }

  // Set by Ctrl+w; the next key picks the window command.
  private _windowPrefix = false;


  handleKeyDown(e: KeyboardEvent) {
    // A Ctrl+w prefix only applies to the very next key in the main pane.
    if (this.lyt.currentFocus() !== "MainPane") this._windowPrefix = false;
    switch (this.lyt.currentFocus()) {
      case "MainPane": this._handleMainPane(e); e.preventDefault(); break;
      case "Navbar":   this._handleNavbar(e); e.preventDefault(); break;
      case "Modal":    this._handleStandard(e); break;
      case "CmdModal": this._handleCmdModal(e); break;
      case "InputElement": this._handleInputElement(e); break;
      default: this.lyt.notify({kind: "Warn", message: "Currently focused element is not registered in motion-service."})
    }
  }

  // ---- MAINPAGE MOTIONS ----
  private _handleMainPane(e: KeyboardEvent) {
    // Pane keys work in every mode; each pane keeps its own.
    if (this.handlePaneKeys(e)) return;
    const mode = this.sqv.mode();

    if (e.key === 'Escape') {
      this.sqv.setMode('Normal');
      e.preventDefault;
      return;
    }

    switch (mode) {
      case "Normal":  this.handleNormal(e); break;
      case "Insert":  this.handleInsert(e); break;
      case "Replace": this.handleReplace(e); break;
      case "Visual":  this.handleVisual(e); break;
    }
    //implement: scrollToCursor();
  }

  /** Ctrl+w v / Ctrl+w s split, Alt+h/j/k/l move between panes. Returns whether e was used. */
  private handlePaneKeys(e: KeyboardEvent): boolean {
    if (this._windowPrefix) {
      if (e.key === 'Control' || e.key === 'Shift') return true;
      this._windowPrefix = false;
      switch (e.key) {
        case 'v': this.panes.split("Vertical");   break;
        case 's': this.panes.split("Horizontal"); break;
      }
      return true;      // any other key just cancels the prefix
    }
    if (e.ctrlKey && e.key === 'w') {
      this._windowPrefix = true;
      return true;
    }
    if (e.altKey && PANE_MOVES[e.code]) {
      this.panes.move(PANE_MOVES[e.code]);
      return true;
    }
    return false;
  }

 private handleNormal(e: KeyboardEvent) {
      switch (e.key) {
      case 'h': case 'ArrowLeft':  this.sqv.moveCursor(-1);         break;
      case 'l': case 'ArrowRight': this.sqv.moveCursor(+1);         break;
      case 'j': case 'ArrowDown':  this.sqv.moveCursor(+LINE_WIDTH);break;
      case 'k': case 'ArrowUp':    this.sqv.moveCursor(-LINE_WIDTH);break;
      case 'w':                    this.sqv.moveCursor(+3);         break;
      case 'b':                    this.sqv.moveCursor(-3);         break;
      case '0': case '^':          this.sqv.moveToLineStart();      break;
      case '$':                    this.sqv.moveToLineEnd();        break;
      case 'g':                    this.sqv.moveToStart();          break;
      case 'G':                    this.sqv.moveToEnd();            break;
      case 'i': this.sqv.setMode('Insert');  break;
      case 'a': this.sqv.moveCursor(+1); this.sqv.setMode('Insert'); break;
      case 'r': this.sqv.setMode('Replace'); break;
      case 'v': this.sqv.setMode('Visual');  break;
      case 'x': this.sqv.deleteAt(this.sqv.cursorPos().offset); break;
      case 'n': this.sqv.jumpToHit(+1); break;
      case 'N': this.sqv.jumpToHit(-1); break;
      case ' ': this.cli.open("Leader");  break;
      case '/': this.cli.open("Search");  break;
      case ':': this.cli.open("Command"); break;
      default: return;
    }
    e.preventDefault();
  }


  private handleInsert(e: KeyboardEvent): void {
    switch (e.key) {
      case 'ArrowLeft':  this.sqv.moveCursor(-1);          e.preventDefault(); break;
      case 'ArrowRight': this.sqv.moveCursor(+1);          e.preventDefault(); break;
      case 'ArrowDown':  this.sqv.moveCursor(+LINE_WIDTH); e.preventDefault(); break;
      case 'ArrowUp':    this.sqv.moveCursor(-LINE_WIDTH); e.preventDefault(); break;
      case 'Backspace':
        this.sqv.deleteAt(this.sqv.cursorPos().offset - 1); e.preventDefault(); break;
      case 'Delete':
        this.sqv.deleteAt(this.sqv.cursorPos().offset); e.preventDefault(); break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const char = e.key.toUpperCase();
          if (IUPAC_CODES.includes(char)) {
            this.sqv.insertAt(this.sqv.cursorPos().offset, char);
          }
          e.preventDefault();
        }
    }
  }


  private handleReplace(e: KeyboardEvent): void {
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const char = e.key.toUpperCase();
      if (IUPAC_CODES.includes(char)) {
        this.sqv.replaceAt(this.sqv.cursorPos().offset, char);
        this.sqv.moveCursor(+1);
      }
      this.sqv.setMode('Normal');
      e.preventDefault();
    } else {
      switch (e.key) {
        case 'ArrowLeft':  this.sqv.moveCursor(-1);          e.preventDefault(); break;
        case 'ArrowRight': this.sqv.moveCursor(+1);          e.preventDefault(); break;
        case 'ArrowDown':  this.sqv.moveCursor(+LINE_WIDTH); e.preventDefault(); break;
        case 'ArrowUp':    this.sqv.moveCursor(-LINE_WIDTH); e.preventDefault(); break;
      }
    }
  }

  private handleVisual(e: KeyboardEvent): void {
    switch (e.key) {
      case 'h': case 'ArrowLeft':  this.sqv.moveCursor(-1);          break;
      case 'l': case 'ArrowRight': this.sqv.moveCursor(+1);          break;
      case 'j': case 'ArrowDown':  this.sqv.moveCursor(+LINE_WIDTH); break;
      case 'k': case 'ArrowUp':    this.sqv.moveCursor(-LINE_WIDTH); break;
      case 'w':                    this.sqv.moveCursor(+2);        break;
      case 'b':                    this.sqv.moveCursor(-2);        break;
      case '0': case '^':          this.sqv.moveToLineStart();      break;
      case '$':                    this.sqv.moveToLineEnd();        break;
      case 'g':                    this.sqv.moveToStart();          break;
      case 'G':                    this.sqv.moveToEnd();            break;
      case 'x': case 'd':          this.sqv.deleteSelection();       break;
      default: return;
    }
    e.preventDefault();
  }

  // ---- NAVBAR MOTIONS ----
  private _handleNavbar(e: KeyboardEvent) {
    //TODO: Implement Navbar Motions?
    e.preventDefault();
  }
  // ---- MODAL MOTIONS ----
  private _handleStandard(e: KeyboardEvent){
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    switch(e.key){
      case ' ': this.cli.open("Leader"); break;
      case 'j': case 'ArrowDown':  this.lyt.moveDown();  break;
      case 'k': case 'ArrowUp':    this.lyt.moveUp();    break;
      case 'h': case 'ArrowLeft':  this.lyt.moveLeft();  break;
      case 'l': case 'ArrowRight': this.lyt.moveRight(); break;
      case 'Enter': this.lyt.handleEnter(); break;
      case 'Escape': this.lyt.handleEsc(); break;
    }
    e.preventDefault();
  }
  // ---- CMD MOTIONS ----
  // Every key not handled here must reach the modal's <input>, so no blanket preventDefault.
  private _handleCmdModal(e: KeyboardEvent){
    if (e.key === "Escape") {
      this.cli.close();
      e.preventDefault();
      return;
    }
    if (this.cli.mode() === "Leader") {
      // Ignore bare modifiers so e.g. Shift+P still reaches the leader as 'P'.
      if (e.key.length === 1) this.cli.pressLeader(e.key);
      e.preventDefault();
      return;
    }
    switch(e.key){
      case "Enter":     this.cli.submit(); break;
      case "ArrowUp":   this.cli.historyPrev(); break;
      case "ArrowDown": this.cli.historyNext(); break;
      case "Tab":       if (!e.shiftKey) this.cli.complete(); break;
      default: return;
    }
    e.preventDefault();
  }

  private _handleInputElement(e: KeyboardEvent) {
    if (e.key === "Escape"){
      this.lyt.toggleInput(this.lyt.activeInput()!);
    }
  }

}
