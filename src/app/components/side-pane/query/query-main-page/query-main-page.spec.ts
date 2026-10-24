import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QueryMainPage } from './query-main-page';

describe('QueryMainPage', () => {
  let component: QueryMainPage;
  let fixture: ComponentFixture<QueryMainPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QueryMainPage],
    }).compileComponents();

    fixture = TestBed.createComponent(QueryMainPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
