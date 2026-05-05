import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

import { TenantResolverService } from '../core/auth/tenant-resolver.service';

/**
 * Shape della risposta del registry:
 * /home/marco/curandis-registry/backend/src/address-lookup/dto/address-lookup.dto.ts
 *   AddressAutocompleteResult { fullAddress, street, streetNumber, city, province,
 *     region, zipCode, countryCode, cadastralCode }
 */
export interface AddressSuggestion {
  fullAddress: string;
  street?: string;
  streetNumber?: string;
  city?: string;
  province?: string;
  region?: string;
  zipCode?: string;
  countryCode?: string;
  /** Codice catastale comune italiano (Belfiore), se applicabile. */
  cadastralCode?: string;
}

/**
 * Wrapper Angular per l'endpoint del registry `GET /address-lookup/autocomplete`.
 *
 * Il registry fa già la chain di provider (Google Places primario, HERE
 * fallback) e gestisce le chiavi via OpenBao. Il clinico chiama il registry
 * direttamente dal browser (CORS *.curandis.cloud abilitato lato registry).
 *
 * Uso tipico in un componente:
 *
 *   suggestions$ = this.searchControl.valueChanges.pipe(
 *     this.addressAutocomplete.searchPipe(),
 *   );
 */
@Injectable({ providedIn: 'root' })
export class AddressAutocompleteService {
  private readonly http = inject(HttpClient);
  private readonly tenantResolver = inject(TenantResolverService);

  search(query: string, countryCode = 'IT'): Observable<AddressSuggestion[]> {
    const trimmed = (query || '').trim();
    if (trimmed.length < 3) return of([]);

    const baseUrl = this.registryBaseUrl();
    if (!baseUrl) return of([]);

    return this.http
      .get<AddressSuggestion[] | { suggestions: AddressSuggestion[] }>(
        `${baseUrl}/address-lookup/autocomplete`,
        {
          // Il DTO del registry richiede `countryCode` (max 2 char), non `country`.
          // Con forbidNonWhitelisted: true qualunque param extra causa 400.
          params: { query: trimmed, countryCode },
          withCredentials: true,
        },
      )
      .pipe(
        // Il registry può tornare sia array diretto sia oggetto wrappato — supportiamo entrambi
        switchMap((res) => of(Array.isArray(res) ? res : res?.suggestions ?? [])),
        catchError((err) => {
          console.warn('[AddressAutocomplete] Registry call failed:', err);
          return of([]);
        }),
      );
  }

  /**
   * Pipe rxjs già pronto: debounce 300ms + distinct + chiamata.
   * Da agganciare a `valueChanges` di un FormControl.
   */
  searchPipe(country = 'IT') {
    return (source: Observable<string | null>) =>
      source.pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((q) => this.search(q ?? '', country)),
      );
  }

  private registryBaseUrl(): string | null {
    const alias = this.tenantResolver.getTenantAlias();
    if (!alias) return null;
    // Il global prefix del registry è "api/v1/registry" (vedi registry main.ts).
    return `https://registry.${alias}.curandis.cloud/api/v1/registry`;
  }
}
