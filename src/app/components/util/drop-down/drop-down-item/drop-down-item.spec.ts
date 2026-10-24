import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DropDownItem } from './drop-down-item';
import { inputBinding } from '@angular/core';

describe('DropDownItem', () => {
  let component: DropDownItem;
  let fixture: ComponentFixture<DropDownItem>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DropDownItem],
    }).compileComponents();

    fixture = TestBed.createComponent(DropDownItem, {
      bindings: [
        inputBinding('optionID', () => testInput.optionID),
        inputBinding('optionName', () => testInput.optionName),
        inputBinding('isTargeted', () => testInput.isTargeted),
        inputBinding('visibleRange', () => testInput.visibleRange),
                ],
    });
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

const testInput = {
  optionID: 1,
  optionName: "TestOption",
  isTargeted: false,
  visibleRange: [0, 3]
}

