import { TestBed } from '@angular/core/testing';
import { LayoutService } from './layout-service';
import { Router } from '@angular/router';
import { MoveGrid } from '../types/side_types';
import { focusLocations, queryPages, GridInjection, GridInjector } from '../types/layout_types';
import { UserDataService } from './user-data';
import { defaultUserInfo } from '../types/data_types';
import { selectableLocations } from '../types/side_types';

describe('LayoutService', () => {
  let service: LayoutService;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        LayoutService,
        { provide: UserDataService, useValue: mockedUserDataService},
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

  it('should retrieve and update user information', () => {
    service.activeAvatar();
    expect(mockedUserDataService.data).toHaveBeenCalledOnce();

    service.changeAvatar("Sheep");
    service.updateTheme();
    expect(mockedUserDataService.updateUserInfo).toHaveBeenCalledTimes(2);
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
      data: ["Injection1", "Injection2"]
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
      data: ["Injection3"]
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
    service.jumpToID("Row0Col1");
    expect(service.selector!.offset).toBe(1);
    service.jumpToOffset(22);
    expect(service.currentlyTargeted()).toMatch("Row5Col0");
    service.moveDown();  //no change
    expect(service.currentlyTargeted()).toMatch("Row5Col0");
  });

  it('should relay Enter events correctly for Query Page', () => {
    service.toggleSidePane("Query");
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
                             "RetrieveVirusBtn", "RetrieveOrganelleBtn" ];
    const spyTriggerBtn = vi.spyOn(service, 'triggerButton');
    for (let btn of queryButtonIDs) {
      spyTarget.mockReturnValue(btn);
      service.handleEnter();
      expect(spyTriggerBtn).toHaveBeenCalledWith(btn);
    }
    // === DROPDOWN ===
    const queryDropDownIDs = [ "QueryDDGenomeOption1", "QueryDDGenomeOption2" ];
    const spyTriggerDD = vi.spyOn(service, 'triggerDropDown');
    for (let dd of queryDropDownIDs) {
      spyTarget.mockReturnValue(dd);
      service.handleEnter();
      expect(spyTriggerDD).toHaveBeenCalledWith(dd);
    }
    // === INPUT ===
    const queryInputIDs = [ "QueryInputGenome" ];
    const spyToggleInput = vi.spyOn(service, 'toggleInput');
    for (let input of queryInputIDs) {
      spyTarget.mockReturnValue(input);
      service.handleEnter();
      expect(spyToggleInput).toHaveBeenCalledWith(input);
    }
  });

  test.todo('should relay Enter events correctly for Profile Page');
  test.todo('should support Notification Events');
  test.todo('should support Modal Events');
  test.todo('should support DropDown Events');
  test.todo('should support Button Events');
  test.todo('should support Input Events');
});

const testGrid: MoveGrid = [
  ["Row0Col0", "Row0Col1", "Row0Col2", "Row0Col3", "Row0Col4"],
  ["Row1Col0", "Row1Col1", "Row1Col2", "Row1Col3", "Row1Col4"],
  ["Row2Col0", "Row2Col1", "Row2Col2"],
  ["Row3Col0", "Row3Col1", "Row3Col2", "Row3Col3"],
  ["Row4Col0", "Row4Col1", "Row4Col2", "Row4Col3", "Row4Col4"],
  ["Row5Col0"]
];

const mockedUserDataService = {
  data: vi.fn().mockReturnValue(defaultUserInfo()),
  updateUserInfo: vi.fn(),
} as unknown as UserDataService;

const mockedRouter = {
  navigateByUrl: vi.fn(),
} as unknown as Router;
