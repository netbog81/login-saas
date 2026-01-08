import { NgModule, NgZone, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { HttpClientModule } from '@angular/common/http';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { ApolloLink, InMemoryCache, WatchQueryFetchPolicy, Observable as ApolloObservable, Operation, FetchResult } from '@apollo/client/core';
import { environment } from '../../environments/environment';

const uri = `${environment.apiUrl}/graphql`;

/**
 * Crea un Apollo Link che forza l'esecuzione dentro NgZone.
 * Questo risolve il problema per cui Apollo Client esegue le callback
 * fuori dalla zona Angular, causando mancati aggiornamenti dell'UI.
 *
 * NOTA: Questo Link opera a livello di Apollo Client, ma apollo-angular
 * query() converte poi il risultato tramite fromLazyPromise() che non
 * ha integrazione NgZone. Per risolvere completamente, usare:
 * - watchQuery().valueChanges.pipe(take(1)) che ha NgZone nativo
 * - oppure RxjsZoneService.inZone() come operatore RxJS
 */
function createZoneAwareLink(ngZone: NgZone): ApolloLink {
  return new ApolloLink((operation: Operation, forward) => {
    return new ApolloObservable<FetchResult>((observer) => {
      const sub = forward(operation).subscribe({
        next: (result: FetchResult) => {
          ngZone.run(() => {
            observer.next(result);
          });
        },
        error: (error: Error) => {
          ngZone.run(() => {
            observer.error(error);
          });
        },
        complete: () => {
          ngZone.run(() => {
            observer.complete();
          });
        },
      });
      return () => sub.unsubscribe();
    });
  });
}

export function createApollo(httpLink: HttpLink, ngZone: NgZone) {
  const http = httpLink.create({ uri });
  const zoneAware = createZoneAwareLink(ngZone);

  return {
    link: ApolloLink.from([zoneAware, http]),
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            operators: {
              merge(existing = [], incoming) {
                return incoming;
              },
            },
            services: {
              merge(existing = [], incoming) {
                return incoming;
              },
            },
            availabilityTemplates: {
              merge(existing = [], incoming) {
                return incoming;
              },
            },
            operatorAvailability: {
              merge(existing = [], incoming) {
                return incoming;
              },
            },
            availableSlots: {
              merge(existing = [], incoming) {
                return incoming;
              },
            },
            groupExceptions: {
              merge(existing = [], incoming) {
                return incoming;
              },
            },
            availabilityAppointmentsByOperator: {
              merge(existing = [], incoming) {
                return incoming;
              },
            },
          },
        },
        Operator: {
          keyFields: ['id'],
        },
        Service: {
          keyFields: ['id'],
        },
        AvailabilityTemplate: {
          keyFields: ['id'],
        },
        AvailabilityException: {
          keyFields: ['id'],
        },
        GroupException: {
          keyFields: ['id'],
        },
        OperatorService: {
          keyFields: ['operatorId', 'serviceId'],
        },
      },
    }),
    defaultOptions: {
      watchQuery: {
        fetchPolicy: 'cache-and-network' as WatchQueryFetchPolicy,
        errorPolicy: 'all' as const,
      },
      query: {
        fetchPolicy: 'network-only' as const,
        errorPolicy: 'all' as const,
      },
    },
  };
}

@NgModule({
  imports: [HttpClientModule],
  providers: [
    provideApollo(() => {
      const httpClient = inject(HttpClient);
      const httpLink = new HttpLink(httpClient);
      const ngZone = inject(NgZone);
      return createApollo(httpLink, ngZone);
    }),
  ],
})
export class GraphQLModule {}