import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SidePane } from './side-pane';

describe('SidePane', () => {
  let component: SidePane;
  let fixture: ComponentFixture<SidePane>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidePane],
    }).compileComponents();

    fixture = TestBed.createComponent(SidePane);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
