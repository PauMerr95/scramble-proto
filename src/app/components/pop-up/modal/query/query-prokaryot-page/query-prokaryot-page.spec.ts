import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QueryProkaryotPage } from './query-prokaryot-page';

describe('QueryProkaryotPage', () => {
  let component: QueryProkaryotPage;
  let fixture: ComponentFixture<QueryProkaryotPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QueryProkaryotPage],
    }).compileComponents();

    fixture = TestBed.createComponent(QueryProkaryotPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
