import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AvatarFalling } from './falling';

describe('Falling', () => {
  let component: AvatarFalling;
  let fixture: ComponentFixture<AvatarFalling>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AvatarFalling],
    }).compileComponents();

    fixture = TestBed.createComponent(AvatarFalling);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
