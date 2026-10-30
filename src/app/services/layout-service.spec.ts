import { TestBed } from '@angular/core/testing';
import { LayoutService } from './layout-service';
import { Router } from '@angular/router';
import { MoveGrid, SelectableLocation } from '../types/layout_types';
import { focusLocations, queryPages, GridInjection, GridInjector } from '../types/layout_types';
import { SettingsService } from './settings-service';
import { selectableLocations } from '../types/layout_types';
import { signal, WritableSignal } from '@angular/core';
import { settingsBaseGrid, settingsSectionIds, settingsSubGrids } from '../move-grids/mv-grids-modals';

describe('LayoutService', () => {
  let service: LayoutService;
  let mockedSettings: { dirty: WritableSignal<boolean>, revert: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    mockedSettings = { dirty: signal(false), revert: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        LayoutService,
        { provide: SettingsService, useValue: mockedSettings },
        { provide: Router,          useValue: mockedRouter},
      ],
    });
    service = TestBed.inject(LayoutService);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  })

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should change Focus', () => {
    expect(service.currentFocus()).toBe(null);
    for (const foc of focusLocations) {
      service.focusOn(foc);
      expect(service.currentFocus()).toMatch(foc);
    }
  });

  it('should return currentTargeted when grid is loaded', () => {
    service.loadGrid(testGrid);
    expect(service.currentlyTargeted()).toBe(testGrid[0][0]);
    service.unloadGrid();
    expect(service.currentlyTargeted()).toBe(null);
  });

  it('should be able to toggle between query Pages', () => {
    for (const page of queryPages) {
      service.changeQueryPage(page);
      expect(service.queryPage()).toMatch(page);
    }
  });

  it('should find ID in grid', () => {
    service.loadGrid(testGrid);
    let offset = 0;
    for (let i = 0; i < testGrid.length; i++) {
      const row = testGrid[i];
      const first = service.bruteFind(row[0]);
      expect(first).toStrictEqual({
        row: i,
        col: 0,
        offset: offset
      });
      if (row.length > 1) {
        const col = row.length - 1;
        const final = service.bruteFind(row[col]);
        expect(final).toStrictEqual({
          row: i,
          col: col,
          offset: offset + col
        });
      }
      offset += row.length;
    }
  });

  it('should inject and eject into grid', () => {
    //INFO: Behold crazy shenanigans to access private methods ...
    const spyFastEject = vi.spyOn(service as any, '_fastEject');
    const spySlowEject = vi.spyOn(service as any, '_slowEject');
    // === FastEject ===
    const injection: GridInjection = {
      insertLoc: {row: 0, col: 0, offset: 0},
      origin: "Row0Col0" as GridInjector,
      axis: "row",
      data: fakeIds("Injection1", "Injection2")
    };
    service.loadGrid(testGrid);
    service.injectIntoGrid(injection);
    const begin_slice = injection.insertLoc.row + 1;
    const end_slice   =  begin_slice + injection.data.length;
    expect(service.currentMoveGrid!
            .slice(begin_slice, end_slice))
            .toStrictEqual(injection.data.map(site => [site]));
    service.ejectFromGrid("Row0Col0" as GridInjector); //Fast Eject
    expect(service.currentMoveGrid).toStrictEqual(testGrid);
    expect(spyFastEject).toHaveBeenCalledOnce();

    // === SlowEject ===
    const killjection: GridInjection = {
      insertLoc: {row: 4, col: 4, offset: 21},
      origin: "Row4Col4" as GridInjector,
      axis: "col",
      data: fakeIds("Injection3")
    };
    service.injectIntoGrid(injection);
    service.injectIntoGrid(killjection); //replaces injection in GridInjectionTracker
    expect(service.ejectFromGrid("Row0Col0" as GridInjector)); //nulls validInjection
    expect(service.ejectFromGrid("Row4Col4" as GridInjector));
    expect(spySlowEject).toHaveBeenCalledTimes(2);

  });

  it('should move selector in grid', () => {
    service.loadGrid(testGrid);
    service.moveUp();   //no change
    expect(service.currentlyTargeted()).toMatch("Row0Col0");
    service.moveDown();
    expect(service.currentlyTargeted()).toMatch("Row1Col0");
    service.moveLeft(); //no change
    expect(service.currentlyTargeted()).toMatch("Row1Col0");
    service.moveRight();
    expect(service.currentlyTargeted()).toMatch("Row1Col1");
    service.jumpToOffset(9);
    expect(service.currentlyTargeted()).toMatch("Row1Col4");
    service.moveRight(); //no change
    expect(service.currentlyTargeted()).toMatch("Row1Col4");
    service.jumpToID(fakeIds("Row0Col1")[0]);
    expect(service.selector!.offset).toBe(1);
    service.jumpToOffset(22);
    expect(service.currentlyTargeted()).toMatch("Row5Col0");
    service.moveDown();  //no change
    expect(service.currentlyTargeted()).toMatch("Row5Col0");
  });

  it('should relay Enter events correctly for Query Page', () => {
    service.toggleModal("Query");
    // === ICONS ===
    const spyTarget = vi.spyOn(service, 'currentlyTargeted');
    const queryPageIcons = selectableLocations.filter(s => s.includes("IconQuery"));
    for (let icon of queryPageIcons) {
      spyTarget.mockReturnValue(icon);
      service.handleEnter();
      expect(service.queryPage()).toMatch(icon.replace("IconQuery", ""));
    }
    // === BUTTONS ===
    const queryButtonIDs = [ "RetrieveGenomeBtn", "RetrieveGeneBtn", "RetrieveProkaryotBtn",
                             "RetrieveVirusBtn", "RetrieveOrganelleBtn" ] as const;
    const spyTriggerBtn = vi.spyOn(service, 'triggerButton');
    for (let btn of queryButtonIDs) {
      spyTarget.mockReturnValue(btn);
      service.handleEnter();
      expect(spyTriggerBtn).toHaveBeenCalledWith(btn);
    }
    // === DROPDOWN ===
    const queryDropDownIDs = [ "QueryDDGenomeOption1", "QueryDDGenomeOption2" ] as const;
    const spyTriggerDD = vi.spyOn(service, 'triggerDropDown');
    for (let dd of queryDropDownIDs) {
      spyTarget.mockReturnValue(dd);
      service.handleEnter();
      expect(spyTriggerDD).toHaveBeenCalledWith(dd);
    }
    // === INPUT ===
    const queryInputIDs = [ "QueryInputGenome" ] as const;
    const spyToggleInput = vi.spyOn(service, 'toggleInput');
    for (let input of queryInputIDs) {
      spyTarget.mockReturnValue(input);
      service.handleEnter();
      expect(spyToggleInput).toHaveBeenCalledWith(input);
    }
  });

  it('should relay Enter events correctly for Settings', () => {
    service.toggleModal("Settings");
    const spyTarget = vi.spyOn(service, 'currentlyTargeted');
    const spyTriggerBtn = vi.spyOn(service, 'triggerButton');
    for (const btn of ["SettingsBtnSave", "SettingsBtnSetKey", "SettingsBtnClearKey"] as const) {
      spyTarget.mockReturnValue(btn);
      service.handleEnter();
      expect(spyTriggerBtn).toHaveBeenCalledWith(btn);
    }
    const spyTriggerDD = vi.spyOn(service, 'triggerDropDown');
    spyTarget.mockReturnValue("SettingsDDThemes");
    service.handleEnter();
    expect(spyTriggerDD).toHaveBeenCalledWith("SettingsDDThemes");
    // Stubbed: the real one moves focus into the input, after which Enter is ignored.
    const spyToggleInput = vi.spyOn(service, 'toggleInput').mockImplementation(() => {});
    for (const input of ["SettingsInputWorkDir", "SettingsInputApiKey"] as const) {
      spyTarget.mockReturnValue(input);
      service.handleEnter();
      expect(spyToggleInput).toHaveBeenCalledWith(input);
    }
    const spyMoveRight = vi.spyOn(service, 'moveRight');
    spyTarget.mockReturnValue("SettingsSecNcbi");
    service.handleEnter();
    expect(spyMoveRight).toHaveBeenCalled();
  });

  it('should merge a layered grid and swap its sub-grid', () => {
    service.loadLayeredGrid(settingsBaseGrid, settingsSubGrids.NCBI, settingsSectionIds.NCBI);
    expect(service.currentMoveGrid).toStrictEqual([
      ["SettingsSecScramble", "SettingsKeyStatus"],
      ["SettingsSecAppearance", "SettingsInputApiKey"],
      ["SettingsSecNcbi", "SettingsBtnSetKey", "SettingsBtnClearKey"],
      ["SettingsBtnSave"],
    ]);
    service.jumpToID("SettingsSecNcbi");
    service.setSubGrid(settingsSubGrids.Appearance, settingsSectionIds.Appearance);
    expect(service.currentMoveGrid![0]).toStrictEqual(["SettingsSecScramble", "SettingsDDThemes"]);
    // The selector survives the swap.
    expect(service.currentlyTargeted()).toBe("SettingsSecNcbi");
    expect(service.selector!.offset).toBe(3);

    service.setSubGrid(null);
    expect(service.currentMoveGrid).toStrictEqual(settingsBaseGrid);
    // The constant grids are never mutated.
    expect(settingsBaseGrid[0]).toStrictEqual(["SettingsSecScramble"]);
  });

  it('should append sub rows past the base and ignore setSubGrid without a base', () => {
    service.setSubGrid(fakeGrid([["A"]]));
    expect(service.currentMoveGrid).toBe(null);
    service.loadLayeredGrid(fakeGrid([["Base0"]]), fakeGrid([["Sub0"], ["Sub1", "Sub1b"]]));
    expect(service.currentMoveGrid).toStrictEqual([["Base0", "Sub0"], ["Sub1", "Sub1b"]]);
  });

  it('should keep j/k inside a layer and cross layers only through h/l', () => {
    service.loadLayeredGrid(settingsBaseGrid, settingsSubGrids.Appearance, settingsSectionIds.Appearance);
    service.jumpToID("SettingsSecAppearance");
    // l enters the sub-grid at its top, even from a row the sub-grid does not reach.
    service.moveRight();
    expect(service.currentlyTargeted()).toBe("SettingsDDThemes");
    // The sub-grid has a single row, so j stays put instead of landing on another section.
    service.moveDown();
    expect(service.currentlyTargeted()).toBe("SettingsDDThemes");
    // h returns to the section the sub-grid belongs to, not to the base cell in its row.
    service.moveLeft();
    expect(service.currentlyTargeted()).toBe("SettingsSecAppearance");
    service.moveDown();
    service.moveDown();
    expect(service.currentlyTargeted()).toBe("SettingsBtnSave");

    service.setSubGrid(settingsSubGrids.NCBI, settingsSectionIds.NCBI);
    service.jumpToID("SettingsKeyStatus");
    service.moveDown();
    expect(service.currentlyTargeted()).toBe("SettingsInputApiKey");
    service.moveDown();
    expect(service.currentlyTargeted()).toBe("SettingsBtnSetKey");
    service.moveRight();
    expect(service.currentlyTargeted()).toBe("SettingsBtnClearKey");
    // The base row below (Save) is not part of the sub-grid, so j stays put.
    service.moveDown();
    expect(service.currentlyTargeted()).toBe("SettingsBtnClearKey");
    // The input row is narrower: k clamps to its only cell.
    service.moveUp();
    expect(service.currentlyTargeted()).toBe("SettingsInputApiKey");
    service.moveUp();
    expect(service.currentlyTargeted()).toBe("SettingsKeyStatus");
  });

  it('should use plain movement while a drop down is open in a layered grid', () => {
    service.loadLayeredGrid(settingsBaseGrid, settingsSubGrids.Appearance, settingsSectionIds.Appearance);
    service.jumpToID("SettingsDDThemes");
    service.injectIntoGrid({
      insertLoc: structuredClone(service.selector!),
      origin: "SettingsDDThemes",
      axis: "row",
      data: ["0_SettingsDDThemes_DarkLime", "1_SettingsDDThemes_Ocean"],
    });
    service.moveDown();
    expect(service.currentlyTargeted()).toBe("0_SettingsDDThemes_DarkLime");
    service.ejectFromGrid("SettingsDDThemes");
    expect(service.currentMoveGrid![1]).toStrictEqual(["SettingsSecAppearance"]);
  });

  it('should clamp the selector into a smaller grid', () => {
    service.loadGrid(testGrid);
    service.jumpToOffset(9);   // Row1Col4
    service.loadGrid(fakeGrid([["A", "B"], ["C"]]));
    expect(service.selector).toStrictEqual({ row: 1, col: 0, offset: 2 });
    expect(service.currentlyTargeted()).toBe("C");
    service.loadGrid(fakeGrid([["A"]]));
    expect(service.selector).toStrictEqual({ row: 0, col: 0, offset: 0 });
  });

  it('should ask twice before leaving Settings with unsaved changes', () => {
    service.toggleModal("Settings");
    mockedSettings.dirty.set(true);
    service.handleEsc();
    expect(service.activeModal()).toBe("Settings");
    expect(service.activeNotifications().at(-1)?.kind).toBe("Warn");
    expect(mockedSettings.revert).not.toHaveBeenCalled();

    service.handleEsc();
    expect(mockedSettings.revert).toHaveBeenCalledOnce();
    expect(service.activeModal()).toBe(null);

    // Switching panels is guarded too, and Enter in between disarms the discard.
    service.toggleModal("Settings");
    service.toggleModal("Query");
    expect(service.activeModal()).toBe("Settings");
    service.handleEnter();
    service.toggleModal("Query");
    expect(service.activeModal()).toBe("Settings");

    mockedSettings.dirty.set(false);
    service.toggleModal("Query");
    expect(service.activeModal()).toBe("Query");
  });

  test.todo('should support Notification Events');
  it('should toggle navbar modals and stack sub-modals', () => {
    service.toggleModal("Settings");
    expect(service.activeModal()).toBe("Settings");
    expect(service.currentFocus()).toBe("Modal");
    expect(mockedRouter.navigateByUrl).toHaveBeenLastCalledWith("modal/settings");

    // A modal opened on top and closed again returns to the panel underneath.
    service.openModal("Files");
    expect(service.activeModal()).toBe("Files");
    expect(service.modalRoot()).toBe("Settings");
    service.closeModal();
    expect(service.activeModal()).toBe("Settings");
    expect(service.currentFocus()).toBe("Modal");
    expect(mockedRouter.navigateByUrl).toHaveBeenLastCalledWith("modal/settings");

    // Another navbar panel replaces the whole stack.
    service.openModal("Files");
    service.toggleModal("Query");
    expect(service.activeModal()).toBe("Query");
    expect(service.modalRoot()).toBe("Query");

    // Toggling the open panel again closes everything.
    service.toggleModal("Query");
    expect(service.activeModal()).toBe(null);
    expect(service.currentFocus()).toBe("MainPane");
    expect(mockedRouter.navigateByUrl).toHaveBeenLastCalledWith("/");
  });

  it('should close an open drop down on Esc before closing the modal', () => {
    service.toggleModal("Settings");
    service.loadGrid([["SettingsDDThemes"], ["SettingsBtnSave"]]);
    service.injectIntoGrid({
      insertLoc: {row: 0, col: 0, offset: 0},
      origin: "SettingsDDThemes",
      axis: "row",
      data: ["0_SettingsDDThemes_DarkLime"],
    });
    const spyTriggerDD = vi.spyOn(service, 'triggerDropDown');
    service.handleEsc();
    expect(spyTriggerDD).toHaveBeenCalledWith("SettingsDDThemes");
    expect(service.activeModal()).toBe("Settings");

    service.ejectFromGrid("SettingsDDThemes");  // what the drop down does when it closes
    service.handleEsc();
    expect(service.activeModal()).toBe(null);
  });
  test.todo('should support DropDown Events');
  test.todo('should support Button Events');
  test.todo('should support Input Events');
});

// The grid mechanics don't care about the ids, so these specs use made-up ones.
function fakeGrid(rows: string[][]): MoveGrid {
  return rows as MoveGrid;
}
function fakeIds(...ids: string[]): SelectableLocation[] {
  return ids as SelectableLocation[];
}

const testGrid: MoveGrid = fakeGrid([
  ["Row0Col0", "Row0Col1", "Row0Col2", "Row0Col3", "Row0Col4"],
  ["Row1Col0", "Row1Col1", "Row1Col2", "Row1Col3", "Row1Col4"],
  ["Row2Col0", "Row2Col1", "Row2Col2"],
  ["Row3Col0", "Row3Col1", "Row3Col2", "Row3Col3"],
  ["Row4Col0", "Row4Col1", "Row4Col2", "Row4Col3", "Row4Col4"],
  ["Row5Col0"]
]);

const mockedRouter = {
  navigateByUrl: vi.fn(),
} as unknown as Router;
