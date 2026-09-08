import { Injectable, Injector } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { BaseGraphQLService } from '../../../core/services/base-graphql.service';
import { PATIENT_PENDING_FE_COLLECTIONS } from '../graphql/pending-fe.operations';
import {
  EMPTY_PENDING_FE_COLLECTIONS,
  PendingFeCollections,
} from '../models/pending-fe.model';

/**
 * Service "sconto FE da incassare" — Layer 3.
 *
 * Sola lettura: l'incasso passa dal flusso di pagamento condiviso
 * (PagamentoSplitDialogComponent + TreatmentService.recordPayment), così la
 * registrazione è identica a quella della pagina Trattamenti — stessi metodi
 * clinici (contanti/voucher FE), stessa mutation, stessi controlli.
 */
@Injectable({ providedIn: 'root' })
export class PendingFeService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  /**
   * Scoperti sconto FE del paziente (fisioterapia + palestra).
   * `network-only` di default: il badge deve riflettere l'incasso appena
   * registrato, non la cache.
   */
  getForPatient(patientId: string): Observable<PendingFeCollections> {
    return this.query<{
      patientPendingFeCollections: PendingFeCollections;
    }>(PATIENT_PENDING_FE_COLLECTIONS, { patientId }).pipe(
      // ApolloZoneService può emettere `undefined` in presenza di errori
      // GraphQL: meglio badge spento che cartella paziente rotta.
      map((r) => r?.patientPendingFeCollections ?? EMPTY_PENDING_FE_COLLECTIONS),
    );
  }
}
