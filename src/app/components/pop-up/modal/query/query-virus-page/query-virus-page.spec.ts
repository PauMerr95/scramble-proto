import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QueryVirusPage } from './query-virus-page';

describe('QueryVirusPage', () => {
  let component: QueryVirusPage;
  let fixture: ComponentFixture<QueryVirusPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QueryVirusPage],
    }).compileComponents();

    fixture = TestBed.createComponent(QueryVirusPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
