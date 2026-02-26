import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class TenantResolverService {
  private readonly NON_TENANT_SUBDOMAINS = [
    'api', 'auth', 'tenants', 'my', 'www', 'agenda',
  ];

  /**
   * Estrae l'alias del tenant dall'hostname corrente.
   * Es: "demo4.curandis.cloud" -> "demo4"
   * Es: "api.curandis.cloud" -> null (non e' un tenant)
   * Es: "localhost:4200" -> defaultTenant da environment
   */
  getTenantAlias(): string | null {
    const hostname = window.location.hostname;

    // Development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return environment.defaultTenant || null;
    }

    // Estrai il sottodominio
    const parts = hostname.split('.');
    if (parts.length < 3) return null;

    const subdomain = parts[0].toLowerCase();

    // Escludi domini di servizio
    if (this.NON_TENANT_SUBDOMAINS.includes(subdomain)) {
      return null;
    }

    return subdomain;
  }

  /**
   * URL base del TMS (Tenant Management System)
   */
  getTmsUrl(): string {
    return 'https://api.curandis.cloud';
  }
}
