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
 * Guard per la home (path vuoto): reindirizza l'utente alla landing page
 * coerente con il suo ruolo, perché non tutti hanno accesso al calendario.
 *
 * Priorità (un utente può avere più ruoli — vince il profilo "ampio"):
 *  - segreteria / admin / amministratore / superadmin → /calendar
 *  - medico                                           → /medico/dashboard
 *  - operatore / istruttore                           → /calendar3 (proprio
 *    calendario in sola lettura; il container calendar-v3 applica read-only
 *    e, per gli istruttori, la modalità palestra in base al ruolo)
 *  - fallback (nessun ruolo noto)                     → /calendar (poi
 *    l'authGuard della rotta mostrerà /unauthorized se non abilitato)
 *
 * Restituisce sempre un UrlTree (mai true): il path '' non ha un componente
 * proprio, serve solo a smistare.
 */
export const homeRedirectGuard: CanActivateFn = async () => {
  const oidcAuth = inject(OidcAuthService);
  const router = inject(Router);

  if (oidcAuth.isTenantMismatch()) {
    return router.parseUrl('/unauthorized?reason=tenant_mismatch');
  }

  if (!oidcAuth.isAuthenticated()) {
    oidcAuth.login();
    return false;
  }

  // Dopo un refresh il profilo potrebbe non essere ancora popolato.
  if (!oidcAuth.currentUser()) {
    try {
      const user = await oidcAuth.loadCurrentUser();
      if (!user) {
        oidcAuth.login();
        return false;
      }
    } catch {
      oidcAuth.login();
      return false;
    }
  }

  const SEGRETERIA_ROLES = ['segreteria', 'admin', 'amministratore', 'superadmin'];

  if (oidcAuth.hasRole(SEGRETERIA_ROLES)) {
    return router.parseUrl('/calendar');
  }
  // Il medico atterra sulla propria dashboard (workspace medico).
  if (oidcAuth.hasRole(['medico'])) {
    return router.parseUrl('/medico/dashboard');
  }
  // Operatore e istruttore atterrano sul calendar-v3 read-only del proprio
  // calendario (l'istruttore in modalità palestra). Il container calendar-v3
  // distingue il ruolo e applica la vista corretta.
  if (oidcAuth.hasRole(['operatore', 'istruttore'])) {
    return router.parseUrl('/calendar3');
  }

  // Fallback: lascia che sia l'authGuard della rotta a decidere.
  return router.parseUrl('/calendar');
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
