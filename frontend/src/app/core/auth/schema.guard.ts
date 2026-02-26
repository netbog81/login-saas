import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { OidcAuthService } from './oidc-auth.service';

const ADMIN_ROLES = ['admin', 'superadmin', 'it_manager', 'amministratore'];

/**
 * Guard: verifica che lo schema del tenant sia pronto (tenantStatus === 'active').
 *
 * Se tenantStatus === 'pending_schema':
 *   - Admin → redirect a /admin?tab=database per avviare il provisioning
 *   - Non admin → redirect a /pending-schema (pagina informativa)
 *
 * Questo guard va applicato DOPO authGuard.
 */
export const schemaGuard: CanActivateFn = async () => {
  const oidcAuth = inject(OidcAuthService);
  const router = inject(Router);

  if (!oidcAuth.isAuthenticated()) {
    oidcAuth.login();
    return false;
  }

  if (oidcAuth.isSchemaReady()) {
    return true;
  }

  // Schema non pronto: discrimina per ruolo
  const isAdmin = oidcAuth.hasRole(ADMIN_ROLES);
  if (isAdmin) {
    router.navigate(['/admin'], { queryParams: { tab: 'database' } });
  } else {
    router.navigate(['/pending-schema']);
  }
  return false;
};
