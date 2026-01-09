import { ApplicationConfig, importProvidersFrom, APP_INITIALIZER, LOCALE_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localeIt from '@angular/common/locales/it';
import { routes } from './app.routes';
import { ApiService } from './services/api.service';
import { GraphQLModule } from './graphql/graphql.module';
import { ApolloZoneService } from './core/services/apollo-zone.service';
import { initializeApp } from './core/services/app-init.service';

// Registra locale italiano
registerLocaleData(localeIt, 'it');

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    importProvidersFrom(HttpClientModule, GraphQLModule),
    ApiService,
    // Locale italiano per DatePipe e altri pipe
    { provide: LOCALE_ID, useValue: 'it' },
    // Assicura che ApolloZoneService sia pronto prima che l'app inizi
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      deps: [ApolloZoneService],
      multi: true
    }
  ]
};