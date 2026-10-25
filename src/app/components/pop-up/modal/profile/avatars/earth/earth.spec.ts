import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AvatarEarth } from './earth';

describe('Earth', () => {
  let component: AvatarEarth;
  let fixture: ComponentFixture<AvatarEarth>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AvatarEarth],
    }).compileComponents();

    fixture = TestBed.createComponent(AvatarEarth);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
