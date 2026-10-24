import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DropDown } from './drop-down';
import { LayoutService } from '../../../services/layout-service';
import { inputBinding } from '@angular/core';

describe('DropDown', () => {
  let component: DropDown;
  let fixture: ComponentFixture<DropDown>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DropDown],
      providers: [
        {provide: LayoutService, useValue: mockedLayoutService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DropDown, {
      bindings: [inputBinding('id', () => testInput.id),
                 inputBinding('optionList', () => testInput.optionList)]
    });
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('optionList should be toggable', async () => {
    component.toggleList();
    expect(component.isOpen()).toBe(true);
    component.toggleList();
    expect(component.isOpen()).toBe(false);
  });

  test.todo('optionList should be scrollable');
  test.todo('chosen options should be registered');
});

const mockedLayoutService = {
  activeDD: vi.fn(),
  updateDD: vi.fn(),
  currentlyTargeted: vi.fn(),
  selector: vi.fn(),
  injectIntoGrid: vi.fn(),
  ejectFromGrid: vi.fn(),
  bruteFind: vi.fn(),
}

const testInput = {
  id: "DropDownTestID",
  optionList: ["Option1", "Option2", "Option3"],
}
