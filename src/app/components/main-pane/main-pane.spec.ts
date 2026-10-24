import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MainPane } from './main-pane';

describe('MainPane', () => {
  let component: MainPane;
  let fixture: ComponentFixture<MainPane>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MainPane],
    }).compileComponents();

    fixture = TestBed.createComponent(MainPane);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
