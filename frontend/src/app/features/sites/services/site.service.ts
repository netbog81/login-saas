/**
 * Site Service
 * Layer 3: business logic + GraphQL
 *
 * Estende BaseGraphQLService (NgZone): nessuna chiamata Apollo diretta.
 */

import { Injectable, Injector } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BaseGraphQLService } from '../../../core/services/base-graphql.service';
import { Site, UpdateSiteInput } from '../models/site.model';
import {
  GET_SITES,
  CREATE_SITE,
  UPDATE_SITE,
  SET_DEFAULT_SITE,
  RESYNC_SITES_TO_ACCOUNTING,
} from '../graphql/site.operations';

@Injectable({ providedIn: 'root' })
export class SiteService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  /** `no-cache`: la designazione di predefinita cambia due righe insieme. */
  getSites(onlyActive = false): Observable<Site[]> {
    return this.query<{ sites: Site[] }>(GET_SITES, { onlyActive }, 'no-cache').pipe(
      map((r) => r.sites),
    );
  }

  createSite(name: string, address?: string): Observable<Site> {
    return this.mutate<{ createSite: Site }>(CREATE_SITE, { name, address }).pipe(
      map((r) => r.createSite),
    );
  }

  updateSite(id: string, input: UpdateSiteInput): Observable<Site> {
    return this.mutate<{ updateSite: Site }>(UPDATE_SITE, { id, ...input }).pipe(
      map((r) => r.updateSite),
    );
  }

  /** Sposta la designazione di predefinita; torna l'elenco aggiornato. */
  setDefaultSite(id: string): Observable<Site[]> {
    return this.mutate<{ setDefaultSite: Site[] }>(SET_DEFAULT_SITE, { id }).pipe(
      map((r) => r.setDefaultSite),
    );
  }

  /** Ripubblica tutte le sedi verso accounting; torna quante ne ha inviate. */
  resyncToAccounting(): Observable<number> {
    return this.mutate<{ resyncSitesToAccounting: number }>(RESYNC_SITES_TO_ACCOUNTING).pipe(
      map((r) => r.resyncSitesToAccounting),
    );
  }
}
