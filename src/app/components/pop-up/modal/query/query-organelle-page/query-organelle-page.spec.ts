import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QueryOrganellePage } from './query-organelle-page';

describe('QueryOrganellePage', () => {
  let component: QueryOrganellePage;
  let fixture: ComponentFixture<QueryOrganellePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QueryOrganellePage],
    }).compileComponents();

    fixture = TestBed.createComponent(QueryOrganellePage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
