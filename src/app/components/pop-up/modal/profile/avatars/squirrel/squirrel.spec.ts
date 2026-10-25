import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AvatarSquirrel } from './squirrel';

describe('Squirrel', () => {
  let component: AvatarSquirrel;
  let fixture: ComponentFixture<AvatarSquirrel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AvatarSquirrel],
    }).compileComponents();

    fixture = TestBed.createComponent(AvatarSquirrel);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
