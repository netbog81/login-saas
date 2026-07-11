import { ApplicationConfig, importProvidersFrom, APP_INITIALIZER, LOCALE_ID } from '@angular/core';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE, MAT_NATIVE_DATE_FORMATS } from '@angular/material/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localeIt from '@angular/common/locales/it';
import { provideOAuthClient } from 'angular-oauth2-oidc';
import { routes } from './app.routes';
import { GraphQLModule } from './graphql/graphql.module';
import { ApolloZoneService } from './core/services/apollo-zone.service';
import { initializeApp } from './core/services/app-init.service';
import { OidcAuthService } from './core/auth/oidc-auth.service';
import { authInterceptor } from './core/auth/auth.interceptor';
import { ItalianDateAdapter } from './core/date/italian-date-adapter';

// Registra locale italiano
registerLocaleData(localeIt, 'it');

/**
 * Inizializzazione OIDC:
 * 1. Configura angular-oauth2-oidc con le coordinate Keycloak
 * 2. Carica il documento di discovery OIDC
 * 3. Se c'è un token valido in sessione (es. dopo refresh), carica /api/me
 */
function initializeOidc(oidcAuth: OidcAuthService): () => Promise<void> {
  return async () => {
    oidcAuth.configure();
    await oidcAuth.initialize();
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    // Provider per angular-oauth2-oidc (usa HttpClient internamente)
    provideOAuthClient(),
    importProvidersFrom(GraphQLModule),
    // Locale italiano per DatePipe e altri pipe
    { provide: LOCALE_ID, useValue: 'it' },
    // Datepicker in locale italiano. NB: usiamo un DateAdapter custom
    // (ItalianDateAdapter) al posto di provideNativeDateAdapter() perché il
    // native adapter parsa l'input digitato con Date.parse() (convenzione US
    // MM/GG/AAAA) e rifiuta il formato italiano GG/MM/AAAA. I formati di
    // visualizzazione restano quelli nativi.
    { provide: MAT_DATE_LOCALE, useValue: 'it-IT' },
    { provide: DateAdapter, useClass: ItalianDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: MAT_NATIVE_DATE_FORMATS },
    // Assicura che ApolloZoneService sia pronto prima che l'app inizi
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      deps: [ApolloZoneService],
      multi: true,
    },
    // Configura OIDC e verifica sessione al caricamento app
    {
      provide: APP_INITIALIZER,
      useFactory: initializeOidc,
      deps: [OidcAuthService],
      multi: true,
    },
  ],
};
