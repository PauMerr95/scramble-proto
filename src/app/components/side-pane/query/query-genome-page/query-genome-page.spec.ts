import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QueryGenomePage } from './query-genome-page';

describe('QueryGenomePage', () => {
  let component: QueryGenomePage;
  let fixture: ComponentFixture<QueryGenomePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QueryGenomePage],
    }).compileComponents();

    fixture = TestBed.createComponent(QueryGenomePage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
