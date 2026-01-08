import { ApplicationConfig, importProvidersFrom, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { routes } from './app.routes';
import { ApiService } from './services/api.service';
import { GraphQLModule } from './graphql/graphql.module';
import { ApolloZoneService } from './core/services/apollo-zone.service';
import { initializeApp } from './core/services/app-init.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    importProvidersFrom(HttpClientModule, GraphQLModule),
    ApiService,
    // Assicura che ApolloZoneService sia pronto prima che l'app inizi
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      deps: [ApolloZoneService],
      multi: true
    }
  ]
};