import { TestBed } from '@angular/core/testing';
import { UserDataService } from './user-data';
import { UserInfo } from '../types/data_types';


describe('UserData', () => {
  let service: UserDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UserDataService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  })

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should retrieve userData from Backend', async () => {
    const spyRetrieveInfo = vi.spyOn(service, 'retrieveUserInfo').mockResolvedValue(undefined);
    const spyRetrieveConfig = vi.spyOn(service, 'retrieveConfigPath').mockResolvedValue(undefined);
    await service.init();
    expect(spyRetrieveInfo).toHaveBeenCalledOnce();
    expect(spyRetrieveConfig).toHaveBeenCalledOnce();
  });

  it('should be able to update complete user information', () => {
    const now = new Date();
    const newUser = {
      id: 666,
      name: "Lightbringer",
      avatar: "Falling",
      theme: "Doom",
      apiKey: "bipidibopidi",
      lastSessionPath: null,
      createdAt: now.toISOString(),
      updatedAt: new Date(now).toISOString(),
    } as UserInfo;
    service.updateUserInfo(newUser);
    expect(service.data()).toStrictEqual(newUser);
  });

  it('should be able to update partial user information keeping rest intact', () => {
    const newUser = {
      name: "Halfling",
      theme: "Swagger",
    } as Partial<UserInfo>;
    service.updateUserInfo(newUser);
    expect(service.data().name).toBe(newUser.name);
    expect(service.data().theme).toBe(newUser.theme);

    //representative verification only
    expect(service.data().id).toBeDefined();
  })
});

class MockUserDataService {
  readonly _SCRAMBLE_CONFIG = vi.fn();
  readonly _API_KEY         = vi.fn();
  readonly _USER_NAME       = vi.fn();
  readonly data  = vi.fn();

  updateUserInfo = vi.fn();
  saveUserInfo   = vi.fn();
  init           = vi.fn().mockResolvedValue(undefined);
};

export const mockedUserDataService = new MockUserDataService();
