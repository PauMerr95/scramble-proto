import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { UserDataService } from './services/user-data';
import { DataSessionService } from './services/data-session-service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideAppInitializer(() => {
      const userData = inject(UserDataService);
      const dataSession = inject(DataSessionService);
      return Promise.all([userData.init(), dataSession.init()]).then(() => undefined);
    })
  ]
};
