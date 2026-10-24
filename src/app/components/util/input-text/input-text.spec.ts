import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InputText } from './input-text';
import { inputBinding } from '@angular/core';
import { LayoutService } from '../../../services/layout-service';

describe('InputText', () => {
  let component: InputText;
  let fixture: ComponentFixture<InputText>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InputText],
      providers: [{ provider: LayoutService, useValue: mockedLayoutService }]
    }).compileComponents();

    fixture = TestBed.createComponent(InputText, {
      bindings: [inputBinding('id', () => testInput.id)],
    });
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

const testInput = {
  id: "TestInputID",
}
const mockedLayoutService = {
  activeInput: vi.fn(),
  currentlyTargeted: vi.fn(),
  focusOn: vi.fn(),
  jumpToID: vi.fn(),
}
