import { Injectable, Injector } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BaseGraphQLService } from '../../../core/services/base-graphql.service';
import {
  GET_PATIENT_DOCUMENTS,
  GET_PATIENT_DOCUMENT_STATS,
  UPDATE_PATIENT_DOCUMENT,
  DELETE_PATIENT_DOCUMENT,
} from '../../../graphql/operations/patient-documents.operations';
import {
  PatientDocument,
  PatientDocumentsFilter,
  PatientDocumentStats,
  UpdatePatientDocumentInput,
} from '../models/patient-document.model';

/**
 * Metadati documenti paziente via GraphQL (Layer 3 — Business + API).
 *
 * Upload/download binari NON passano da qui: vedi
 * PatientDocumentsTransferService (REST multipart/blob).
 *
 * Gli enum GraphQL viaggiano come NAME maiuscolo (es. "PRESCRIPTION"):
 * questo service normalizza da/verso i valori minuscoli del modello.
 */
@Injectable({ providedIn: 'root' })
export class PatientDocumentsService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  getDocuments(
    subjectId: string,
    filter?: PatientDocumentsFilter,
  ): Observable<PatientDocument[]> {
    return this.query<{ patientDocuments: PatientDocument[] }>(
      GET_PATIENT_DOCUMENTS,
      { subjectId, filter: this.toGraphqlFilter(filter) },
      'network-only',
    ).pipe(
      map((result) => (result.patientDocuments || []).map((d) => this.mapDocument(d))),
    );
  }

  getStats(subjectId: string): Observable<PatientDocumentStats> {
    return this.query<{ patientDocumentStats: PatientDocumentStats }>(
      GET_PATIENT_DOCUMENT_STATS,
      { subjectId },
      'network-only',
    ).pipe(
      map((result) => {
        const stats = result.patientDocumentStats;
        return {
          ...stats,
          byCategory: (stats.byCategory || []).map((c) => ({
            ...c,
            category: this.lower(c.category),
          })),
          byKind: (stats.byKind || []).map((k) => ({ ...k, kind: this.lower(k.kind) })),
        };
      }),
    );
  }

  updateDocument(
    id: string,
    input: UpdatePatientDocumentInput,
  ): Observable<PatientDocument> {
    const gqlInput: Record<string, unknown> = { ...input };
    if (input.category) gqlInput['category'] = input.category.toUpperCase();
    return this.mutate<{ updatePatientDocument: PatientDocument }>(
      UPDATE_PATIENT_DOCUMENT,
      { id, input: gqlInput },
    ).pipe(map((result) => this.mapDocument(result.updatePatientDocument)));
  }

  /** Soft delete: il documento finisce nel cestino. */
  deleteDocument(id: string): Observable<boolean> {
    return this.mutate<{ deletePatientDocument: boolean }>(
      DELETE_PATIENT_DOCUMENT,
      { id },
    ).pipe(map((result) => result.deletePatientDocument));
  }

  // ==================== MAPPING ====================

  private mapDocument(doc: PatientDocument): PatientDocument {
    return {
      ...doc,
      category: this.lower(doc.category),
      contentKind: this.lower(doc.contentKind),
    };
  }

  private toGraphqlFilter(
    filter?: PatientDocumentsFilter,
  ): Record<string, unknown> | undefined {
    if (!filter) return undefined;
    const out: Record<string, unknown> = { ...filter };
    if (filter.scope) out['scope'] = filter.scope.toUpperCase();
    if (filter.category) out['category'] = filter.category.toUpperCase();
    if (filter.contentKind) out['contentKind'] = filter.contentKind.toUpperCase();
    return out;
  }

  /** Enum GraphQL NAME → valore modello (bijezione: parole singole). */
  private lower<T extends string>(value: T): T {
    return (value ? value.toLowerCase() : value) as T;
  }
}
