import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Notification } from './notification';
import { inputBinding } from '@angular/core';

describe('Notification', () => {
  let spyInit = vi.spyOn(Notification.prototype, 'ngOnInit')
                  .mockImplementation(() => {});
  let spyDest = vi.spyOn(Notification.prototype, 'ngOnDestroy')
                  .mockImplementation(() => {});
  const testNotification = {
    id: 0,
    kind: "Info",
    message: "mocked test notification"
  };
  let component: Notification;
  let fixture: ComponentFixture<Notification>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Notification],
    }).compileComponents();

    fixture = TestBed.createComponent(Notification, {
      bindings: [inputBinding('notification', () => testNotification)]
    });
    component = fixture.componentInstance;
    await fixture.whenStable();
  });
  afterEach(() => {
    vi.clearAllMocks();
  })

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(spyInit).toHaveBeenCalledOnce();
  });
  it('should destroy', async () => {
    component.dismiss();
    await fixture.whenStable();
    expect(spyDest).toHaveBeenCalledOnce();
  })
});
