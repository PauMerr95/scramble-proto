import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AvatarSheep } from './sheep';

describe('Sheep', () => {
  let component: AvatarSheep;
  let fixture: ComponentFixture<AvatarSheep>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AvatarSheep],
    }).compileComponents();

    fixture = TestBed.createComponent(AvatarSheep);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
