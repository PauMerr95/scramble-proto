import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AvatarDuck } from './duck';

describe('Duck', () => {
  let component: AvatarDuck;
  let fixture: ComponentFixture<AvatarDuck>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AvatarDuck],
    }).compileComponents();

    fixture = TestBed.createComponent(AvatarDuck);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
