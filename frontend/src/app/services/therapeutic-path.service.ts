import { Injectable, Injector } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  TherapeuticPath,
  Anamnesis,
  PathStatus,
} from '../models/therapeutic-path.model';
import { BaseGraphQLService } from '../core/services/base-graphql.service';

// Queries
import {
  GET_THERAPEUTIC_PATH,
  GET_THERAPEUTIC_PATHS_BY_PATIENT,
  GET_THERAPEUTIC_PATHS_BY_PATIENTS,
  GET_ACTIVE_THERAPEUTIC_PATHS_BY_PATIENT,
  GET_THERAPEUTIC_PATHS_BY_OPERATOR,
  GET_PATIENT_EVALUATION,
  GET_EVALUATIONS_BY_PATH,
} from '../graphql/operations/therapeutic-path.queries';

// Mutations
import {
  CREATE_THERAPEUTIC_PATH,
  UPDATE_THERAPEUTIC_PATH,
  DELETE_THERAPEUTIC_PATH,
  CREATE_PATIENT_EVALUATION,
  UPDATE_PATIENT_EVALUATION,
  DELETE_PATIENT_EVALUATION,
} from '../graphql/operations/therapeutic-path.mutations';

// Backend types (from GraphQL)
interface BackendTherapeuticPath {
  id: string;
  patientId: string;
  primaryOperatorId: string;
  name: string;
  diagnosis?: string;
  icdCode?: string;
  status: 'active' | 'suspended' | 'completed' | 'archived';
  externalDoctorName?: string;
  externalPrescriptionRef?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  primaryOperator?: {
    id: string;
    name: string;
    surname: string;
    appUserId?: string | null;
  };
  evaluations?: BackendPatientEvaluation[];
}

interface BackendPatientEvaluation {
  id: string;
  therapeuticPathId: string;
  operatorId: string;
  templateId?: string;
  chiefComplaint?: string;
  historyOfPresentIllness?: string;
  aggravatingFactors?: string;
  relievingFactors?: string;
  patientGoals?: string;
  therapistGoals?: string;
  functionalAssessment?: string;
  conclusions?: string;
  fieldValues?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  operator?: {
    id: string;
    name: string;
    surname: string;
  };
}

// Input types for mutations
export interface CreateTherapeuticPathInput {
  patientId: string;
  primaryOperatorId: string;
  name: string;
  diagnosis?: string;
  icdCode?: string;
  externalDoctorName?: string;
  externalPrescriptionRef?: string;
  notes?: string;
}

export interface UpdateTherapeuticPathInput {
  name?: string;
  diagnosis?: string;
  icdCode?: string;
  status?: PathStatus;
  externalDoctorName?: string;
  externalPrescriptionRef?: string;
  notes?: string;
}

export interface CreateEvaluationInput {
  therapeuticPathId: string;
  operatorId: string;
  templateId?: string;
  chiefComplaint?: string;
  historyOfPresentIllness?: string;
  aggravatingFactors?: string;
  relievingFactors?: string;
  patientGoals?: string;
  therapistGoals?: string;
  functionalAssessment?: string;
  conclusions?: string;
  fieldValues?: Record<string, unknown>;
}

export interface UpdateEvaluationInput {
  chiefComplaint?: string;
  historyOfPresentIllness?: string;
  aggravatingFactors?: string;
  relievingFactors?: string;
  patientGoals?: string;
  therapistGoals?: string;
  functionalAssessment?: string;
  conclusions?: string;
  fieldValues?: Record<string, unknown>;
}

/**
 * Servizio per gestire i Percorsi Terapeutici
 * Collegato alle API GraphQL reali
 *
 * NOTA: Il mock originale e' stato rinominato in therapeutic-path.service.mock.ts
 * per riferimento durante lo sviluppo.
 */
@Injectable({
  providedIn: 'root',
})
export class TherapeuticPathService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  // ==================== HELPER FUNCTIONS ====================

  /**
   * Converte il percorso backend nel formato frontend
   */
  private mapBackendToFrontend(backend: BackendTherapeuticPath): TherapeuticPath {
    return {
      id: backend.id,
      patientId: backend.patientId,
      name: backend.name,
      description: backend.notes,
      diagnosis: backend.diagnosis,
      icdCode: backend.icdCode,
      primaryOperatorId: backend.primaryOperatorId,
      primaryOperatorName: backend.primaryOperator
        ? `${backend.primaryOperator.name} ${backend.primaryOperator.surname || ''}`.trim()
        : undefined,
      primaryOperatorAppUserId: backend.primaryOperator?.appUserId ?? null,
      status: backend.status,
      startDate: backend.createdAt,
      actualEndDate: backend.closedAt,
      anamnesis: this.mapEvaluationToAnamnesis(backend.evaluations?.[0]),
      notes: backend.notes,
      createdAt: backend.createdAt,
      updatedAt: backend.updatedAt,
    };
  }

  /**
   * Converte la valutazione backend in anamnesi frontend
   */
  private mapEvaluationToAnamnesis(
    evaluation?: BackendPatientEvaluation
  ): Anamnesis | undefined {
    if (!evaluation) return undefined;

    return {
      id: evaluation.id,
      pathId: evaluation.therapeuticPathId,
      chiefComplaint: evaluation.chiefComplaint || '',
      historyOfPresentIllness: evaluation.historyOfPresentIllness || '',
      aggravatingFactors: evaluation.aggravatingFactors
        ? evaluation.aggravatingFactors.split(',').map((s) => s.trim())
        : undefined,
      relievingFactors: evaluation.relievingFactors
        ? evaluation.relievingFactors.split(',').map((s) => s.trim())
        : undefined,
      patientGoals: evaluation.patientGoals,
      therapistGoals: evaluation.therapistGoals,
      createdAt: evaluation.createdAt,
      updatedAt: evaluation.updatedAt,
      createdBy: evaluation.operatorId,
    };
  }

  // NOTA: mapBackendDocument rimosso — i documenti sono ora della scheda
  // paziente (features/patient-documents, entity patient_documents).

  // ==================== PATH QUERIES ====================

  /**
   * Ottiene tutti i percorsi terapeutici di un paziente.
   * Usa no-cache per evitare che query parallele per pazienti diversi
   * si sovrascrivano nella cache normalizzata Apollo.
   */
  getPathsByPatient(patientId: string): Observable<TherapeuticPath[]> {
    return this.query<{ therapeuticPathsByPatient: BackendTherapeuticPath[] }>(
      GET_THERAPEUTIC_PATHS_BY_PATIENT,
      { patientId },
      'no-cache'
    ).pipe(
      map((result) =>
        (result.therapeuticPathsByPatient ?? []).map((p) => this.mapBackendToFrontend(p))
      )
    );
  }

  /**
   * Ottiene tutti i percorsi terapeutici per più pazienti in una singola query.
   */
  getPathsByPatients(patientIds: string[]): Observable<TherapeuticPath[]> {
    if (patientIds.length === 0) return new Observable(s => { s.next([]); s.complete(); });
    return this.query<{ therapeuticPathsByPatients: BackendTherapeuticPath[] }>(
      GET_THERAPEUTIC_PATHS_BY_PATIENTS,
      { patientIds },
      'no-cache'
    ).pipe(
      map((result) =>
        (result.therapeuticPathsByPatients ?? []).map((p) => this.mapBackendToFrontend(p))
      )
    );
  }

  /**
   * Ottiene un singolo percorso con tutti i dettagli
   */
  getPath(pathId: string): Observable<TherapeuticPath | null> {
    return this.query<{ therapeuticPath: BackendTherapeuticPath | null }>(
      GET_THERAPEUTIC_PATH,
      { id: pathId }
    ).pipe(
      map((result) =>
        result.therapeuticPath ? this.mapBackendToFrontend(result.therapeuticPath) : null
      )
    );
  }

  /**
   * Ottiene i percorsi attivi di un paziente
   */
  getActivePathsByPatient(patientId: string): Observable<TherapeuticPath[]> {
    return this.query<{ activeTherapeuticPathsByPatient: BackendTherapeuticPath[] }>(
      GET_ACTIVE_THERAPEUTIC_PATHS_BY_PATIENT,
      { patientId }
    ).pipe(
      map((result) =>
        (result.activeTherapeuticPathsByPatient ?? []).map((p) => this.mapBackendToFrontend(p))
      )
    );
  }

  /**
   * Ottiene percorsi per operatore
   */
  getPathsByOperator(operatorId: string): Observable<TherapeuticPath[]> {
    return this.query<{ therapeuticPathsByOperator: BackendTherapeuticPath[] }>(
      GET_THERAPEUTIC_PATHS_BY_OPERATOR,
      { operatorId }
    ).pipe(
      map((result) =>
        (result.therapeuticPathsByOperator ?? []).map((p) => this.mapBackendToFrontend(p))
      )
    );
  }

  /**
   * Conta i percorsi attivi per paziente (per badge/statistiche)
   */
  getActivePathsCount(patientId: string): Observable<number> {
    return this.getActivePathsByPatient(patientId).pipe(map((paths) => paths.length));
  }

  /**
   * Ottiene statistiche per paziente
   */
  getPatientPathStats(patientId: string): Observable<{
    total: number;
    active: number;
    completed: number;
    suspended: number;
  }> {
    return this.getPathsByPatient(patientId).pipe(
      map((paths) => ({
        total: paths.length,
        active: paths.filter((p) => p.status === 'active').length,
        completed: paths.filter((p) => p.status === 'completed').length,
        suspended: paths.filter((p) => p.status === 'suspended').length,
      }))
    );
  }

  // ==================== EVALUATION QUERIES ====================

  /**
   * Ottiene l'anamnesi/valutazione di un percorso (la prima valutazione)
   */
  getAnamnesisByPath(pathId: string): Observable<Anamnesis | null> {
    return this.query<{ evaluationsByPath: BackendPatientEvaluation[] }>(
      GET_EVALUATIONS_BY_PATH,
      { pathId }
    ).pipe(
      map((result) => {
        const evaluations = result.evaluationsByPath ?? [];
        return evaluations.length > 0
          ? this.mapEvaluationToAnamnesis(evaluations[0]) || null
          : null;
      })
    );
  }

  // ==================== PATH MUTATIONS ====================

  /**
   * Crea un nuovo percorso terapeutico
   */
  createPath(input: CreateTherapeuticPathInput): Observable<TherapeuticPath> {
    return this.mutate<{ createTherapeuticPath: BackendTherapeuticPath }>(
      CREATE_THERAPEUTIC_PATH,
      { input }
    ).pipe(map((result) => this.mapBackendToFrontend(result.createTherapeuticPath)));
  }

  /**
   * Aggiorna un percorso terapeutico
   */
  updatePath(id: string, input: UpdateTherapeuticPathInput): Observable<TherapeuticPath> {
    return this.mutate<{ updateTherapeuticPath: BackendTherapeuticPath }>(
      UPDATE_THERAPEUTIC_PATH,
      { id, input }
    ).pipe(map((result) => this.mapBackendToFrontend(result.updateTherapeuticPath)));
  }

  /**
   * Elimina un percorso terapeutico
   */
  deletePath(id: string): Observable<boolean> {
    return this.mutate<{ deleteTherapeuticPath: boolean }>(
      DELETE_THERAPEUTIC_PATH,
      { id }
    ).pipe(map((result) => result.deleteTherapeuticPath));
  }

  // ==================== EVALUATION MUTATIONS ====================

  /**
   * Crea una nuova valutazione
   *
   * NB: schema backend rinominato `createPatientEvaluation` → `createEvaluation`.
   * Il response field è ora `result.createEvaluation`.
   */
  createEvaluation(input: CreateEvaluationInput): Observable<Anamnesis> {
    return this.mutate<{ createEvaluation: BackendPatientEvaluation }>(
      CREATE_PATIENT_EVALUATION,
      { input }
    ).pipe(map((result) => this.mapEvaluationToAnamnesis(result.createEvaluation)!));
  }

  /**
   * Aggiorna una valutazione
   */
  updateEvaluation(id: string, input: UpdateEvaluationInput): Observable<Anamnesis> {
    return this.mutate<{ updateEvaluation: BackendPatientEvaluation }>(
      UPDATE_PATIENT_EVALUATION,
      { id, input }
    ).pipe(map((result) => this.mapEvaluationToAnamnesis(result.updateEvaluation)!));
  }

  /**
   * Elimina una valutazione
   */
  deleteEvaluation(id: string): Observable<boolean> {
    return this.mutate<{ deleteEvaluation: boolean }>(
      DELETE_PATIENT_EVALUATION,
      { id }
    ).pipe(map((result) => result.deleteEvaluation));
  }

  // NOTA: le DOCUMENT MUTATIONS (createDocument/deleteDocument) sono state
  // sostituite dalla feature patient-documents (upload REST multipart +
  // mutation GraphQL su patient_documents).
}
