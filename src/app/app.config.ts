import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { SettingsService } from './services/settings-service';
import { DataSessionService } from './services/data-session-service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideAppInitializer(() => {
      const settings = inject(SettingsService);
      const dataSession = inject(DataSessionService);
      return Promise.all([settings.init(), dataSession.init()]).then(() => undefined);
    })
  ]
};
