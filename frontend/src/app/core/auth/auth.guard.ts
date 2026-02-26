import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { OidcAuthService } from './oidc-auth.service';

/**
 * Guard: verifica che l'utente sia autenticato con Keycloak.
 * Se non c'è un token valido, avvia il redirect a Keycloak (Authorization Code + PKCE).
 * Non redirige a /login locale — la pagina di login è Keycloak stesso.
 * Supporta ruoli opzionali nella route data.
 */
export const authGuard: CanActivateFn = async (route) => {
  const oidcAuth = inject(OidcAuthService);
  const router = inject(Router);

  // Se il token è per un'org diversa dal subdomain, blocca subito.
  // Non chiamare login() — causerebbe un loop con la sessione SSO Keycloak.
  if (oidcAuth.isTenantMismatch()) {
    router.navigate(['/unauthorized'], { queryParams: { reason: 'tenant_mismatch' } });
    return false;
  }

  if (!oidcAuth.isAuthenticated()) {
    oidcAuth.login();
    return false;
  }

  // Assicurati che currentUser sia popolato (dopo refresh pagina)
  if (!oidcAuth.currentUser()) {
    try {
      const user = await oidcAuth.loadCurrentUser();
      if (!user) {
        oidcAuth.login();
        return false;
      }
    } catch (err: any) {
      if (err?.type === 'TENANT_MISMATCH') {
        oidcAuth.isTenantMismatch.set(true);
        router.navigate(['/unauthorized'], { queryParams: { reason: 'tenant_mismatch' } });
        return false;
      }
      oidcAuth.login();
      return false;
    }
  }

  // Verifica ruoli se la rotta li richiede
  const requiredRoles = route.data?.['roles'] as string[] | undefined;
  if (requiredRoles && !oidcAuth.hasRole(requiredRoles)) {
    router.navigate(['/unauthorized']);
    return false;
  }

  return true;
};

/**
 * Guard: con Keycloak Organizations il linking è implicito nell'appartenenza all'org.
 * Mantenuto per retrocompatibilità — passa sempre se autenticato.
 */
export const linkedGuard: CanActivateFn = async () => {
  const oidcAuth = inject(OidcAuthService);

  if (!oidcAuth.isAuthenticated()) {
    oidcAuth.login();
    return false;
  }

  return true;
};
