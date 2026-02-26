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
      // Warmup con cache-only: inizializza Apollo + NgZone senza chiamata HTTP.
      // Al bootstrap non c'è ancora un token Keycloak, quindi network-only darebbe 401.
      apolloZone.query({
        query: gql`query { __typename }`,
        fetchPolicy: 'cache-only'
      }).subscribe({
        next: () => {
          console.log('✅ ApolloZoneService ready');
          resolve();
        },
        error: () => {
          // cache-only senza dati in cache è un "miss" silenzioso — risolvi comunque
          console.log('✅ ApolloZoneService ready (cache empty, normal at startup)');
          resolve();
        }
      });
    });
  };
}
