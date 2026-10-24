import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalAvatars } from './modal-avatars';

describe('ModalAvatars', () => {
  let component: ModalAvatars;
  let fixture: ComponentFixture<ModalAvatars>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModalAvatars],
    }).compileComponents();

    fixture = TestBed.createComponent(ModalAvatars);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
