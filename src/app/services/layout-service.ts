import { Injectable, signal, inject, computed, untracked } from '@angular/core';
import { NavbarLocation, FocusLocation, QueryPage,
         NotificationObject, ActiveNotification, ModalTitle, modals,
         GridInjector, GridInjection, GridInjectorTracker } from '../types/layout_types';
import { MoveGrid, SelectableLocation } from '../types/side_types';
import { CursorPos } from '../types/main_types';
import { Router } from '@angular/router';
import { SettingsService } from './settings-service';
import { ButtonID, DropDownID, InputID } from '../types/util_types';

@Injectable({
  providedIn: 'root',
})
export class LayoutService {
  // === Injection ===
  private readonly settings = inject(SettingsService);
  private readonly _router = inject(Router);

  // === States ===
  private _queryPage     = signal<QueryPage>("QueryMain");
  private _currentFocus  = signal<FocusLocation | null>(null);
  // === Events ===
  readonly activeBtn   = signal<ButtonID | null>(null);
  readonly activeDD    = signal<DropDownID | null>(null);
  readonly updateDD    = signal<number | null>(null);
  readonly activeInput = signal<InputID | null>(null);

  // === Movement === TODO: Consider moving to motion service
  private _currentMoveGrid = signal<MoveGrid | null>(null)
  private _selector = signal<CursorPos | null>(null)
  private _gridTracker: GridInjectorTracker = {
    validInjection: null,
    injections: new Map<GridInjector, GridInjection>(),
  };
  // Layered grid (see loadLayeredGrid); kept apart so a sub-grid swap is a rebuild, not a splice.
  private _baseGrid: MoveGrid | null = null;
  private _subGrid:  MoveGrid | null = null;
  private _subAnchor: SelectableLocation | null = null;
  // Set by the first attempt to leave Settings with unsaved changes.
  private _discardArmed = false;


  //INFO: for testing purposes
  get selector(){ return this._selector() };
  get currentMoveGrid(){ return this._currentMoveGrid() };

  // === Pop-Ups ===
  private _notificationIDCounter = 0;
  private _notificationQueue = signal<NotificationObject[]>([])
  readonly activeNotifications = signal<ActiveNotification[]>([])
  // Opened modals, bottom to top. Only the top one is rendered.
  private _modalStack = signal<ModalTitle[]>([]);
  readonly activeModal = computed(() => this._modalStack().at(-1) ?? null);
  // The navbar panel the open modals started from.
  readonly modalRoot   = computed(() => this._modalStack()[0] ?? null);

  // === Exports ===
  readonly currentFocus = this._currentFocus.asReadonly();
  readonly queryPage = this._queryPage.asReadonly();

  // === PRIVATE METHODS ===
  private _fastEject(injector: GridInjector) {
    if (this._currentMoveGrid() === null) return;
    if (!this._gridTracker.injections.has(injector)) return;
    const inj: GridInjection = this._gridTracker.injections.get(injector)!;
    this._currentMoveGrid.update(grid => {
      switch (inj.axis) {
        case 'col': {
          grid![inj.insertLoc.row].splice(inj.insertLoc.col + 1, inj.data.length);
          break;
        }
        case 'row': {
          grid!.splice(inj.insertLoc.row + 1, inj.data.length)
          break;
        }
      }
      return grid;
    });
    this._selector.update(pos => this._correctRowCol(this._currentMoveGrid()!, pos!));
  }

  private _slowEject(injector: GridInjector) {
    //TODO: UNTESTED FEATURE ...
    if (this._currentMoveGrid() === null) return;
    if (!this._gridTracker.injections.has(injector)) return;

    const injection = this._gridTracker.injections.get(injector)!;
    this._gridTracker.injections.delete(injector);
    let grid = this._currentMoveGrid();
    let result = this.bruteFind(injection.data[0]);
    if (result === null) {
      this.notify({
        kind: "Error",
        message: "Could not find first occurance of injection in move grid; might have already been removed."
      }); return;
    }
    switch (injection.axis) {
      case 'col': {
        grid![result.row].splice(result.col, injection.data.length); break;
      }
      case 'row': {
        grid!.splice(result.row, injection.data.length); break;
      }
    }


  }

  private _drainQueue() {
    const openSlots = 4 - this.activeNotifications().length;
    if (openSlots <= 0) return;
    const q = this._notificationQueue();
    const add = q.slice(0, openSlots).map(n => ({...n, id: this._notificationIDCounter++}))
    this._notificationQueue.update(q => q.slice(add.length));
    this.activeNotifications.update(active => [...active, ...add]);
  }

  /** Clamps pos into the grid and recomputes its offset. Always returns a new object, so
   *  readers of `currentlyTargeted()` (effects included) see every move. */
  private _correctRowCol(grid: MoveGrid = this._currentMoveGrid()!,
                         pos: CursorPos = this._selector()!): CursorPos{
    const row = Math.min(Math.max(pos.row, 0), grid.length - 1);
    const col = Math.min(Math.max(pos.col, 0), grid[row].length - 1);
    let offset = col;
    for (let i = 0; i < row; i++) offset += grid[i].length;
    return { row: row, col: col, offset: offset };
  }

  private _moveTo(row: number, col: number) {
    this._selector.set(this._correctRowCol(this._currentMoveGrid()!, { row: row, col: col, offset: 0 }));
    console.log(`Row: ${this._selector()!.row}, Col: ${this._selector()!.col}, Offset: ${this._selector()!.offset}, Target: ${String(this.currentlyTargeted())}`);
  }

  // Row i of the merged grid is base row i followed by sub row i (sub rows past the base stand alone).
  private _mergeLayers(): MoveGrid {
    const base = this._baseGrid ?? [];
    const sub  = this._subGrid ?? [];
    return Array.from({ length: Math.max(base.length, sub.length) },
                      (_, i) => [...(base[i] ?? []), ...(sub[i] ?? [])]);
  }
  // null when no layered grid is loaded, or while a drop down is open: its injected rows shift
  // the row indices against the base grid, so plain movement applies until it closes.
  private _layerAt(row: number, col: number): "Base" | "Sub" | null {
    if (this._baseGrid === null || this._gridTracker.injections.size > 0) return null;
    return (col < (this._baseGrid[row]?.length ?? 0)) ? "Base" : "Sub";
  }
  private _layerHasRow(layer: "Base" | "Sub" | null, row: number): boolean {
    if (layer === null) return true;
    const grid = this._currentMoveGrid()!;
    const baseLen = this._baseGrid![row]?.length ?? 0;
    return (layer === "Base") ? baseLen > 0 : (grid[row]?.length ?? 0) > baseLen;
  }

  /** Leaving Settings with unsaved changes takes a second try, which discards them (:q / :q!). */
  private _mayLeaveSettings(): boolean {
    if (this.activeModal() !== "Settings" || !this.settings.dirty()) {
      this._discardArmed = false;
      return true;
    }
    if (this._discardArmed) {
      this._discardArmed = false;
      this.settings.revert();
      return true;
    }
    this._discardArmed = true;
    this.notify({ kind: "Warn", message: "Unsaved settings. Esc again to discard, or Save" });
    return false;
  }

  // === PUBLIC METHODS ===
  currentlyTargeted(): null | SelectableLocation{
    if (!this._currentMoveGrid() || !this._selector()) return null;
    return this._currentMoveGrid()![this._selector()!.row][this._selector()!.col];
  }

  focusOn(foc: FocusLocation | null) {
    this._currentFocus.set(foc);
  }

  // Untracked: panels call this from effects, and reading the selector it writes would
  // re-run them on every move.
  loadGrid(grid: MoveGrid){
    untracked(() => {
      if (!this._selector()) {
        this._selector.set({row: 0, col: 0, offset: 0});
      }
      this._currentMoveGrid.set(grid);
      this._selector.update(pos => this._correctRowCol(grid, pos!));
    });
  }
  unloadGrid() {
    this._selector.set(null);
    this._currentMoveGrid.set(null);
    this._baseGrid  = null;
    this._subGrid   = null;
    this._subAnchor = null;
    this._gridTracker.validInjection = null;
    this._gridTracker.injections.clear();
  }
  updateGrid(fn: (mvg: MoveGrid | null) => MoveGrid | null) {
    const newGrid = fn(this._currentMoveGrid());
    if (newGrid) {
      this.loadGrid(newGrid);
      return;
    }
    this.unloadGrid();
  }

  /** A fixed base grid with a swappable sub-grid to its right (settings sections).
   *  `anchor` is the base cell the sub-grid belongs to; h leads back to it. */
  loadLayeredGrid(base: MoveGrid, sub: MoveGrid | null = null, anchor: SelectableLocation | null = null) {
    this._baseGrid  = base;
    this._subGrid   = sub;
    this._subAnchor = anchor;
    this._gridTracker.validInjection = null;
    this._gridTracker.injections.clear();
    this.loadGrid(this._mergeLayers());
  }
  /** Swaps the sub-grid (null ejects it). Drop down injections go with the old one. */
  setSubGrid(sub: MoveGrid | null, anchor: SelectableLocation | null = null) {
    if (this._baseGrid === null) return;
    this.loadLayeredGrid(this._baseGrid, sub, anchor);
  }
  // In a layered grid j/k stay inside their layer, l from the base enters the sub-grid at its
  // top and h from the sub-grid's first column returns to its anchor. Rows only line up by
  // index, so crossing anywhere else would land on an unrelated base cell.
  moveDown() {
    if (!this._currentMoveGrid() || !this._selector()) return;
    const { row, col } = this._selector()!;
    if (row >= this._currentMoveGrid()!.length - 1) return;
    if (!this._layerHasRow(this._layerAt(row, col), row + 1)) return;
    this._moveTo(row + 1, col);
  }
  moveUp() {
    if (!this._currentMoveGrid() || !this._selector()) return;
    const { row, col } = this._selector()!;
    if (row <= 0) return;
    if (!this._layerHasRow(this._layerAt(row, col), row - 1)) return;
    this._moveTo(row - 1, col);
  }
  moveLeft() {
    if (!this._currentMoveGrid() || !this._selector()) return;
    const { row, col } = this._selector()!;
    if (this._layerAt(row, col) === "Sub" && col === (this._baseGrid![row]?.length ?? 0)) {
      if (this._subAnchor) this.jumpToID(this._subAnchor);
      return;
    }
    if (col <= 0) return;
    this._moveTo(row, col - 1);
  }
  moveRight() {
    if (!this._currentMoveGrid() || !this._selector()) return;
    const { row, col } = this._selector()!;
    if (this._layerAt(row, col) === "Base") {
      const entry = this._subGrid?.[0]?.[0];
      if (entry) this.jumpToID(entry);
      return;
    }
    if (this._currentMoveGrid()![row].length - 1 <= col) return;
    this._moveTo(row, col + 1);
  }

  jumpToID(id: SelectableLocation){
    const result = this.bruteFind(id);
    if (result) this._selector.set(result);
  }

  jumpToOffset(offset: number){
    if (!offset) return;
    if (!this._currentMoveGrid() || !this._selector()) return;
    console.log("Movegrid and selector are valid");
    if (offset <= 0) {
      console.log("Move to start intentionally");
      this._selector.set({row: 0, col: 0, offset: 0});
    }
    let remaining = offset;
    const grid = this._currentMoveGrid()!;
    let rowIdx = 0;
    while (rowIdx < grid.length && grid[rowIdx].length <= remaining) {
      remaining -= grid[rowIdx].length;
      rowIdx++;
    }
    if (rowIdx >= grid.length) return;
    this._selector.set({
      row: rowIdx,
      col: remaining,
      offset: offset
    })
  }

  changeQueryPage(newPage: QueryPage) {
    this._queryPage.set(newPage);
  }

  handleEsc() {
    if (this.currentFocus() !== "Modal") return;
    // An open drop down closes first; it ejects its options from the grid itself.
    const openDD = this._gridTracker.validInjection;
    if (openDD !== null) {
      this.triggerDropDown(openDD);
      return;
    }
    this.closeModal();
  }

  handleEnter() {
    if (this.currentFocus() !== "Modal") return;
    switch (this.activeModal()) {
      case "Query":
        switch (this.currentlyTargeted()) {
          case "IconQueryGenome":    this.changeQueryPage("Genome"); break;
          case "IconQueryGene":      this.changeQueryPage("Gene"); break;
          case "IconQueryProkaryot": this.changeQueryPage("Prokaryot"); break;
          case "IconQueryVirus":     this.changeQueryPage("Virus"); break;
          case "IconQueryOrganelle": this.changeQueryPage("Organelle"); break;
          // === BUTTONS ===
          case "RetrieveGenomeBtn":  this.triggerButton("RetrieveGenomeBtn"); break;
          case "RetrieveGeneBtn":    this.triggerButton("RetrieveGeneBtn"); break;
          case "RetrieveProkaryotBtn":  this.triggerButton("RetrieveProkaryotBtn"); break;
          case "RetrieveVirusBtn":      this.triggerButton("RetrieveVirusBtn"); break;
          case "RetrieveOrganelleBtn":  this.triggerButton("RetrieveOrganelleBtn"); break;
          // === DROPDOWNS ===
          case "QueryDDGenomeOption1":   this.triggerDropDown("QueryDDGenomeOption1"); break;
          case "QueryDDGenomeOption2":   this.triggerDropDown("QueryDDGenomeOption2"); break;
          // === INPUT ===
          case "QueryInputGenome":       this.toggleInput("QueryInputGenome"); break;
          default: this.checkDropDownOption();
        }
        break;
      case "Settings":
        this._discardArmed = false;
        switch (this.currentlyTargeted()) {
          // Sections switch on hover; Enter steps into the section.
          case "SettingsSecScramble":
          case "SettingsSecAppearance":
          case "SettingsSecNcbi":        this.moveRight(); break;
          // === BUTTONS ===
          case "SettingsBtnSave":        this.triggerButton("SettingsBtnSave"); break;
          case "SettingsBtnSetKey":      this.triggerButton("SettingsBtnSetKey"); break;
          case "SettingsBtnClearKey":    this.triggerButton("SettingsBtnClearKey"); break;
          // === DROPDOWNS ===
          case "SettingsDDThemes":       this.triggerDropDown("SettingsDDThemes"); break;
          // === INPUT ===
          case "SettingsInputWorkDir":   this.toggleInput("SettingsInputWorkDir"); break;
          case "SettingsInputApiKey":    this.toggleInput("SettingsInputApiKey"); break;
          default: this.checkDropDownOption();
        }
        break;
    }
  }

  checkDropDownOption() {
    //INFO: Very inefficient but works ...
    if (!this.currentlyTargeted()) return;
    const target = this.currentlyTargeted()!.split('_');
    if (target.length !== 3) return;
    const [idItem, idDropDown, _] = target;
    const positionDropDown = this.bruteFind(idDropDown as SelectableLocation);
    if (positionDropDown) {
      this._selector.set(
        this._correctRowCol(this._currentMoveGrid()!, positionDropDown)
      );
    }
    this.loadUpdate(parseInt(idItem));
    this.triggerDropDown(idDropDown as DropDownID);
  }

  loadUpdate(idx: number) {
    this.updateDD.set(idx);
    setTimeout(() => this.updateDD.set(null), 200);
  }

  notify(notification: NotificationObject){
    console.log(`Triggering notification => kind: ${notification.kind} | message: ${notification.message}`);
    this._notificationQueue.update((q) => [...q, notification]);
    this._drainQueue();
  }

  dismissNotification(id: number) {
    this.activeNotifications.update(
      active => active.filter(notification => notification.id != id)
    );
    this._drainQueue();
  }

  /** Navbar and leader: open a panel on its own, or close it if it is already open. */
  toggleModal(title: NavbarLocation) {
    if (this.modalRoot() === title) {
      this.closeAllModals();
      return;
    }
    if (!this._mayLeaveSettings()) return;
    this._modalStack.set([]);
    this.openModal(title);
  }
  /** Opens a modal on top of the current one; closeModal returns to it. */
  openModal(title: ModalTitle) {
    this._discardArmed = false;
    this.unloadGrid();
    this._modalStack.update(stack => [...stack, title]);
    this._router.navigateByUrl(modals[title].route);
    this.focusOn("Modal");
  }
  /** Closes the top modal and goes back to the one underneath, if any. */
  closeModal(){
    if (!this._mayLeaveSettings()) return;
    this.unloadGrid();
    this._modalStack.update(stack => stack.slice(0, -1));
    const top = this.activeModal();
    this._router.navigateByUrl(top ? modals[top].route : '/');
    this.focusOn(top ? "Modal" : "MainPane");
  }
  closeAllModals(){
    if (!this._mayLeaveSettings()) return;
    this.unloadGrid();
    this._modalStack.set([]);
    this._router.navigateByUrl('/');
    this.focusOn("MainPane");
  }

  dbg() {
    console.log(`
      === Layout Service Debug Information ===
      active Focus:      ${this.currentFocus()},\n
      Modal Stack:       ${this._modalStack()},\n
      Query Page Status: ${this.queryPage()},\n
      MoveGrid:          ${this._currentMoveGrid()},\n
      Selector:          ROW: ${this._selector()?.row} | COL: ${this._selector()?.col} | OFF: ${this._selector()?.offset},\n
      Targeted:          ${this.currentlyTargeted()},
      NotificationQueue: ${this._notificationQueue()},\n
      MoveGrid:          \n${this.mvGrid_toString(this._currentMoveGrid())},\n
      InjTracker:        valid:      ${this._gridTracker.validInjection};
                         injections: ${this._gridTracker.injections};
    `);
  }
  mvGrid_toString(grid: MoveGrid | null): string {
    if (!grid) return ""
    return `[${grid.map(arr => '\t[' + arr.reduce((a, b) => a + ', ' + b) + '],\n')}]`;
  }


  triggerButton(id: ButtonID) {
    this.activeBtn.set(id);
    setTimeout(() => this.activeBtn.set(null), 200);
  }
  triggerDropDown(id: DropDownID) {
    this.activeDD.set(id);
    setTimeout(() => this.activeDD.set(null), 200);
  }
  toggleInput(id: InputID) {
    this.activeInput.update(state => {
      if (state === id) {
        this.focusOn("Modal");
        return null;
      }
      this.focusOn("InputElement");
      return id;
    });
  }

  injectIntoGrid(inj: GridInjection) {
    if (this._currentMoveGrid() === null) return;
    this._currentMoveGrid.update(grid => {
      switch (inj.axis) {
        case 'col': {
          grid![inj.insertLoc.row].splice(inj.insertLoc.col + 1, 0, ...inj.data);
          break;
        }
        case 'row': {
          grid!.splice(inj.insertLoc.row + 1, 0, ...inj.data.map(loc => [loc]));
          break;
        }
      }
      return grid;
    });
    this._gridTracker.validInjection = inj.origin;
    this._gridTracker.injections.set(inj.origin, inj);
  }

  ejectFromGrid(inj: GridInjector) {
    if (this._gridTracker.validInjection === inj) {
      this._fastEject(inj);
    } else {
      this._slowEject(inj);
    }
    this._gridTracker.validInjection = null;
    this._gridTracker.injections.delete(inj);
  }

  bruteFind(id: SelectableLocation): CursorPos | null{
    // === Don't look away ===
    let row = 0;
    let offset = 0;
    while (row < this._currentMoveGrid()!.length) {
      const col = this._currentMoveGrid()![row].findIndex(loc => loc === id);
      if (col >= 0) return {row: row, col: col, offset: offset + col};
      offset += this._currentMoveGrid()![row].length;
      row++;
    }
    return null;
  }

}
