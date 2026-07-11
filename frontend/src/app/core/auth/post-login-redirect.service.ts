import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { OidcAuthService } from './oidc-auth.service';

@Injectable({ providedIn: 'root' })
export class PostLoginRedirectService {
  private readonly router = inject(Router);
  private readonly oidcAuth = inject(OidcAuthService);

  redirect(): void {
    const user = this.oidcAuth.currentUser();
    if (!user) {
      this.oidcAuth.login();
      return;
    }

    // Home dinamica per ruolo via homeRedirectGuard sulla root '' — il
    // CallbackComponent gestisce già i redirect speciali (pending_schema,
    // suspended, ecc.). Non hardcodiamo /calendar: l'operatore non vi accede.
    this.router.navigateByUrl('/');
  }
}
