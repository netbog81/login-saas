import { ApolloZoneService } from './apollo-zone.service';
import { gql } from '@apollo/client/core';

/**
 * Factory function per APP_INITIALIZER.
 * Assicura che ApolloZoneService sia pronto prima che l'app inizi.
 *
 * Questo risolve i problemi di timing dove le prime query GraphQL
 * potrebbero essere eseguite fuori da NgZone se Apollo non è ancora
 * completamente inizializzato.
 */
export function initializeApp(apolloZone: ApolloZoneService): () => Promise<void> {
  return () => {
    console.log('🔧 Initializing ApolloZoneService...');
    return new Promise<void>((resolve) => {
      // Query di test per "scaldare" Apollo e verificare che NgZone funzioni
      apolloZone.query({
        query: gql`query { __typename }`,
        fetchPolicy: 'network-only'
      }).subscribe({
        next: () => {
          console.log('✅ ApolloZoneService ready');
          resolve();
        },
        error: (err) => {
          // Log dell'errore ma risolvi comunque per non bloccare l'app
          // L'errore potrebbe essere "Schema introspection not allowed" che è ok
          console.warn('⚠️ ApolloZoneService warmup query failed (this may be normal):', err.message);
          resolve();
        }
      });
    });
  };
}
