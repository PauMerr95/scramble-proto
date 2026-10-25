import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AvatarBird } from './bird';

describe('Bird', () => {
  let component: AvatarBird;
  let fixture: ComponentFixture<AvatarBird>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AvatarBird],
    }).compileComponents();

    fixture = TestBed.createComponent(AvatarBird);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
