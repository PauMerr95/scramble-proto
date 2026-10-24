import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QueryGenePage } from './query-gene-page';

describe('QueryGenePage', () => {
  let component: QueryGenePage;
  let fixture: ComponentFixture<QueryGenePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QueryGenePage],
    }).compileComponents();

    fixture = TestBed.createComponent(QueryGenePage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
