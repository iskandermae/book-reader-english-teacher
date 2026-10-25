import { ApplicationConfig, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { client } from './api/client.gen';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // The generated client defaults to the contract's `servers` URL (test host).
    // Use same-origin relative URLs; `ng serve` proxies /api to the backend (proxy.conf.json).
    provideAppInitializer(() => {
      client.setConfig({ baseUrl: '' });
    }),
  ],
};
