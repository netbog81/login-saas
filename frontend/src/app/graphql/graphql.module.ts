import { NgModule, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { HttpClientModule } from '@angular/common/http';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { InMemoryCache, WatchQueryFetchPolicy } from '@apollo/client/core';
import { environment } from '../../environments/environment';

const uri = `${environment.apiUrl}/graphql`;

export function createApollo(httpLink: HttpLink) {
  return {
    link: httpLink.create({ uri }),
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
      return createApollo(httpLink);
    }),
  ],
})
export class GraphQLModule {}