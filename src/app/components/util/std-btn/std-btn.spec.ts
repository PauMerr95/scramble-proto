import { ComponentFixture, TestBed } from '@angular/core/testing';
import { inputBinding } from '@angular/core';
import { StdBtn } from './std-btn';
import { LayoutService } from '../../../services/layout-service';

describe('StdBtn', () => {
  let component: StdBtn;
  let fixture: ComponentFixture<StdBtn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StdBtn],
      providers: [{ provider: LayoutService, useValue: mockedLayoutService }],
    }).compileComponents();

    fixture = TestBed.createComponent(StdBtn, { bindings: [inputBinding('id', () => "TestButton")]});
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

const mockedLayoutService = {
  activeBtn: vi.fn(),
  currentlyTargeted: vi.fn(),
}
