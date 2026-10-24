import { Injectable, signal, inject, computed } from '@angular/core';
import { NavbarLocation, FocusLocation, QueryPage,
         NotificationObject, ActiveNotification, ModalObject,
         GridInjector, GridInjection, GridInjectorTracker } from '../types/layout_types';
import { MoveGrid, SelectableLocation } from '../types/side_types';
import { CursorPos } from '../types/main_types';
import { Router } from '@angular/router';
import { Avatar } from '../types/side_types';
import { Theme } from '../types/layout_types';
import { UserDataService } from './user-data';
import { ButtonID, DropDownID, InputID } from '../types/util_types';

@Injectable({
  providedIn: 'root',
})
export class LayoutService {
  // === Injection ===
  readonly user = inject(UserDataService);
  private readonly _router = inject(Router);

  // === States ===
  private _sidePaneState = signal<NavbarLocation>("Hidden");
  private _queryPage     = signal<QueryPage>("QueryMain");
  private _currentFocus  = signal<FocusLocation | null>(null);
  readonly activeAvatar  = computed(() => {
    return this.user.data().avatar as Avatar;
  });
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


  //INFO: for testing purposes
  get selector(){ return this._selector() };
  get currentMoveGrid(){ return this._currentMoveGrid() };

  // === Pop-Ups ===
  private _notificationIDCounter = 0;
  private _notificationQueue = signal<NotificationObject[]>([])
  readonly activeNotifications = signal<ActiveNotification[]>([])
  readonly activeModal = signal<ModalObject | null>(null);

  // === Exports ===
  readonly sidePaneState = this._sidePaneState.asReadonly();
  readonly currentFocus = this._currentFocus.asReadonly();
  readonly queryPage = this._queryPage.asReadonly();
  readonly currentTheme = signal<Theme>("DarkLime");

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

  private _correctRowCol(grid: MoveGrid = this._currentMoveGrid()!,
                         pos: CursorPos = this._selector()!): CursorPos{
    // TODO: Check logic and and calls to this function. Does not work and will return positions for undefined targets

    // Rows
    let row = pos.row;
    const MAXROW = grid.length - 1;
    let recalcOffset = false;
    if (row > MAXROW) {
      recalcOffset = true;
      row = MAXROW;
    }
    // Columns
    let col = pos.col;
    const MAXCOL = grid[row].length;
    if (col > MAXCOL) {
      recalcOffset = true;
      row = MAXCOL;
    }
    col = Math.min(col, MAXCOL);
    // Offset
    if (recalcOffset) {
      let offset = col;
      for (let i = 0; i<row; i++) offset += grid[i].length;
      return {
        row: row,
        col: col,
        offset: offset,
      }
    }
    return pos;
  }

  // === PUBLIC METHODS ===
  currentlyTargeted(): null | SelectableLocation{
    if (!this._currentMoveGrid() || !this._selector()) return null;
    return this._currentMoveGrid()![this._selector()!.row][this._selector()!.col];
  }

  toggleSidePane(location: NavbarLocation) {
    this._sidePaneState.update((currState) => {
      if (currState === location) {
        //BUG: Fix at some point - Works fine but could be unsafe in the future
        this.unloadGrid();
        return "Hidden";}
      return location;
    });
    (this._sidePaneState() === "Hidden") ? this.focusOn("MainPane") : this.focusOn("SidePane");
  }

  focusOn(foc: FocusLocation | null) {
    this._currentFocus.set(foc);
  }

  loadGrid(grid: MoveGrid){
    if (!this._selector()) {
      this._selector.set({row: 0, col: 0, offset: 0});
    }
    this._currentMoveGrid.set(grid);
    this._selector.update(pos => this._correctRowCol(grid, pos!));
  }
  unloadGrid() {
    this._selector.set(null);
    this._currentMoveGrid.set(null);
  }
  updateGrid(fn: (mvg: MoveGrid | null) => MoveGrid | null) {
    const newGrid = fn(this._currentMoveGrid());
    if (newGrid) {
      this.loadGrid(newGrid);
      return;
    }
    this.unloadGrid();
  }

  moveDown() {
    if (!this._currentMoveGrid() || !this._selector()) return;
    if (this._selector()!.row >= this._currentMoveGrid()!.length - 1) return;
    const row = this._selector()!.row;
    const col = this._selector()!.col;
    let moves = this._currentMoveGrid()![row!].length - col!;
    this._selector()!.row++;
    this._selector.update(pos => this._correctRowCol(this._currentMoveGrid()!, pos!));
    moves += this._selector()!.col;
    this._selector()!.offset += moves;
    console.log(`Row: ${this._selector()!.row}, Col: ${this._selector()!.col},  Offset: ${this._selector()!.offset}, Target: ${String(this.currentlyTargeted())}`);
  }
  moveUp() {
    if (!this._currentMoveGrid() || !this._selector()) return;
    if (this._selector()!.row <= 0) return;
    let moves = this._selector()!.col;
    this._selector()!.row--;
    this._selector.update(pos => this._correctRowCol(this._currentMoveGrid()!, pos!));
    moves += this._currentMoveGrid()![this._selector()!.row].length - this._selector()!.col;
    this._selector()!.offset -= moves;
    console.log(`Row: ${this._selector()!.row}, Col: ${this._selector()!.col}, Offset: ${this._selector()!.offset}, Target: ${String(this.currentlyTargeted())}`);
  }
  moveLeft() {
    if (!this._currentMoveGrid() || !this._selector()) return;
    if (this._selector()!.col <= 0) return;
    this._selector()!.col--;
    this._selector()!.offset--;
    console.log(`row: ${this._selector()!.row}, col: ${this._selector()!.col}, offset: ${this._selector()!.offset}`);
  }
  moveRight() {
    if (!this._currentMoveGrid() || !this._selector()) return;
    const row = this._selector()!.row;
    if (this._currentMoveGrid()![row].length - 1 <= this._selector()!.col) return;
    this._selector()!.col++;
    this._selector()!.offset++;
    console.log(`row: ${this._selector()!.row}, col: ${this._selector()!.col}, offset: ${this._selector()!.offset}`);
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
    if (this.currentFocus() === "SidePane") {
      // === remove all injections ===
      if (this._gridTracker.validInjection !== null) {
        this._fastEject(this._gridTracker.validInjection);
        for (let inj in this._gridTracker.injections.keys()) {
          this._slowEject(inj as GridInjector);
        }
      }
    }
  }

  handleEnter() {
    if (this.currentFocus() === "SidePane") {
      if (this._sidePaneState() === "Query") {
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
      }
      if (this._sidePaneState() === "Profile") {
        switch (this.currentlyTargeted()){
          case "ProfileAvatar":
            this.openModal({title: "AvatarMenu", route: 'modal/avatars'}); break;
          case "ProfileBtnSave":    this.triggerButton("ProfileBtnSave"); break;
          case "ProfileDDThemes":   this.triggerDropDown("ProfileDDThemes"); break;
          default: this.checkDropDownOption();
        }
      }
    } else if (this.currentFocus() === "Modal"){
        switch(this.activeModal()!.title) {
          case "AvatarMenu": this.changeAvatar(this.currentlyTargeted()!); this.closeModal(); break
      }
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

  changeAvatar(newAvatar: Avatar) {
    this.user.updateUserInfo({avatar: newAvatar});
  }
  updateTheme() {
    const newTheme = this.currentTheme();
    this.user.updateUserInfo({theme: newTheme});
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

  openModal(modal: ModalObject) {
    this.activeModal.set(modal);
    this._router.navigateByUrl(modal.route);
    this.focusOn("Modal");
  }
  closeModal(){
    this.activeModal.set(null);
    this._router.navigateByUrl('/');
    this.focusOn("MainPane");
  }

  dbg() {
    console.log(`
      === Layout Service Debug Information ===
      active Focus:      ${this.currentFocus()},\n
      Side Pane Status:  ${this.sidePaneState()},\n
      Query Page Status: ${this.queryPage()},\n
      MoveGrid:          ${this._currentMoveGrid()},\n
      Selector:          ROW: ${this._selector()?.row} | COL: ${this._selector()?.col} | OFF: ${this._selector()?.offset},\n
      Targeted:          ${this.currentlyTargeted()},
      NotificationQueue: ${this._notificationQueue()},\n
      Active Avatar:     ${this.activeAvatar()},\n
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
        this.focusOn("SidePane");
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
