import { computed, signal, Injectable } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { defaultUserInfo, UserInfo } from '../types/data_types';


function dbgUserInfo(user: UserInfo): void {
  console.log(`
    Id: ${user.name},
    name: ${user.name},
    avatar: ${user.avatar},
    theme: ${user.theme},
    apiKey: ${user.apiKey},
    lastSessionPath: ${user.lastSessionPath},
    createdAt: ${user.createdAt},
    updatedAt: ${user.updatedAt},
  `);
}

@Injectable({
  providedIn: 'root',
})
export class UserDataService {
  private _userData        = signal<UserInfo>(defaultUserInfo());

  readonly _SCRAMBLE_CONFIG = signal<string>("");
  readonly _API_KEY = computed(() => {
    return this._userData().apiKey;
  });
  readonly _USER_NAME = computed(() => {
    return this._userData().name;
  });
  readonly data = this._userData.asReadonly();

  constructor() {}

  // Getters and Setters:
  public updateUserInfo(info: Partial<UserInfo>) {
      this._userData.update((user) => {
        const cleaned = Object.fromEntries(
          Object.entries(info).filter(([, value]) => value !== undefined)
        ) as Partial<UserInfo>;
          return {...user, ...cleaned};
      });
  }

  // --- RUST BACKEND FUNCTIONS ---
   //INFO: init must ba called in app bootstrap. Moved away from constructor.
  async init(): Promise<void> {
    try {
      await this.retrieveConfigPath();
      await this.retrieveUserInfo();
    } catch (err) {
      console.error('UserDataService was unable to load user data, continuing with default values');
    }
  }

  async retrieveUserInfo(){
    const data = await invoke<UserInfo>('get_user_info');
    this._userData.set(data);
    console.log("Retrieved User Information from File");
    dbgUserInfo(this._userData());
  }

  async saveUserInfo(){
    console.log("Saving User Information to File");
    dbgUserInfo(this._userData());
    await invoke<null>('save_user_info',
        {userData: this._userData(),
         configPath: this._SCRAMBLE_CONFIG()})
      .catch((err) => {
          console.log(`Encountered error trying to save user data: ${err}`);
        });
  }

  async retrieveConfigPath(){
    await invoke<string>('get_config_path')
    .then((path) => {
      this._SCRAMBLE_CONFIG.set(path);
    })
    .catch((err) => {
      console.log(`Error during retrieval of Scramble Home Path: ${err}`);
    })

  }
}
