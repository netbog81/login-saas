import { Injectable, Injector } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  TherapeuticPath,
  PathDocument,
  Anamnesis,
  PathStatus,
} from '../models/therapeutic-path.model';
import { BaseGraphQLService } from '../core/services/base-graphql.service';

// Queries
import {
  GET_THERAPEUTIC_PATH,
  GET_THERAPEUTIC_PATHS_BY_PATIENT,
  GET_ACTIVE_THERAPEUTIC_PATHS_BY_PATIENT,
  GET_THERAPEUTIC_PATHS_BY_OPERATOR,
  GET_PATIENT_EVALUATION,
  GET_EVALUATIONS_BY_PATH,
  GET_DOCUMENTS_BY_PATH,
  GET_DOCUMENTS_BY_PATH_AND_CATEGORY,
} from '../graphql/operations/therapeutic-path.queries';

// Mutations
import {
  CREATE_THERAPEUTIC_PATH,
  UPDATE_THERAPEUTIC_PATH,
  DELETE_THERAPEUTIC_PATH,
  CREATE_PATIENT_EVALUATION,
  UPDATE_PATIENT_EVALUATION,
  DELETE_PATIENT_EVALUATION,
  CREATE_PATH_DOCUMENT,
  DELETE_PATH_DOCUMENT,
} from '../graphql/operations/therapeutic-path.mutations';

// Backend types (from GraphQL)
interface BackendTherapeuticPath {
  id: string;
  patientId: number;
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
  };
  patient?: {
    id: number;
    nome: string;
    cognome: string;
    codiceFiscale?: string;
    telefono?: string;
    email?: string;
  };
  evaluations?: BackendPatientEvaluation[];
  documents?: BackendPathDocument[];
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

interface BackendPathDocument {
  id: string;
  therapeuticPathId: string;
  type: 'pdf' | 'image' | 'video' | 'other';
  category: 'prescription' | 'report' | 'radiology' | 'consent' | 'other';
  fileName: string;
  originalFileName?: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  thumbnailPath?: string;
  externalDoctorName?: string;
  notes?: string;
  description?: string;
  uploadedBy?: string;
  uploadedAt: string;
}

// Input types for mutations
export interface CreateTherapeuticPathInput {
  patientId: number;
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

export interface CreateDocumentInput {
  therapeuticPathId: string;
  type: 'pdf' | 'image' | 'video' | 'other';
  category: 'prescription' | 'report' | 'radiology' | 'consent' | 'other';
  fileName: string;
  originalFileName?: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  thumbnailPath?: string;
  externalDoctorName?: string;
  notes?: string;
  description?: string;
  uploadedBy?: string;
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
      status: backend.status,
      startDate: backend.createdAt,
      actualEndDate: backend.closedAt,
      anamnesis: this.mapEvaluationToAnamnesis(backend.evaluations?.[0]),
      documents: backend.documents?.map((d) => this.mapBackendDocument(d)),
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

  /**
   * Converte il documento backend nel formato frontend
   */
  private mapBackendDocument(doc: BackendPathDocument): PathDocument {
    // Map backend category to frontend category string
    const categoryMap: Record<string, string> = {
      prescription: 'prescrizione',
      report: 'referti',
      radiology: 'radiografia',
      consent: 'consensi',
      other: 'altro',
    };

    return {
      id: doc.id,
      pathId: doc.therapeuticPathId,
      name: doc.originalFileName || doc.fileName,
      type: doc.type,
      url: doc.storagePath, // In futuro sara un URL firmato
      thumbnailUrl: doc.thumbnailPath,
      mimeType: doc.mimeType,
      sizeBytes: doc.fileSize,
      uploadedAt: doc.uploadedAt,
      uploadedBy: doc.uploadedBy,
      notes: doc.notes,
      category: categoryMap[doc.category] || doc.category,
    };
  }

  // ==================== PATH QUERIES ====================

  /**
   * Ottiene tutti i percorsi terapeutici di un paziente
   */
  getPathsByPatient(patientId: number): Observable<TherapeuticPath[]> {
    return this.query<{ therapeuticPathsByPatient: BackendTherapeuticPath[] }>(
      GET_THERAPEUTIC_PATHS_BY_PATIENT,
      { patientId }
    ).pipe(
      map((result) =>
        (result.therapeuticPathsByPatient ?? []).map((p) => this.mapBackendToFrontend(p))
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
  getActivePathsByPatient(patientId: number): Observable<TherapeuticPath[]> {
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
  getActivePathsCount(patientId: number): Observable<number> {
    return this.getActivePathsByPatient(patientId).pipe(map((paths) => paths.length));
  }

  /**
   * Ottiene statistiche per paziente
   */
  getPatientPathStats(patientId: number): Observable<{
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

  // ==================== DOCUMENT QUERIES ====================

  /**
   * Ottiene i documenti di un percorso
   */
  getDocumentsByPath(pathId: string): Observable<PathDocument[]> {
    return this.query<{ documentsByPath: BackendPathDocument[] }>(
      GET_DOCUMENTS_BY_PATH,
      { pathId }
    ).pipe(
      map((result) => (result.documentsByPath ?? []).map((d) => this.mapBackendDocument(d)))
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
   */
  createEvaluation(input: CreateEvaluationInput): Observable<Anamnesis> {
    return this.mutate<{ createPatientEvaluation: BackendPatientEvaluation }>(
      CREATE_PATIENT_EVALUATION,
      { input }
    ).pipe(map((result) => this.mapEvaluationToAnamnesis(result.createPatientEvaluation)!));
  }

  /**
   * Aggiorna una valutazione
   */
  updateEvaluation(id: string, input: UpdateEvaluationInput): Observable<Anamnesis> {
    return this.mutate<{ updatePatientEvaluation: BackendPatientEvaluation }>(
      UPDATE_PATIENT_EVALUATION,
      { id, input }
    ).pipe(map((result) => this.mapEvaluationToAnamnesis(result.updatePatientEvaluation)!));
  }

  /**
   * Elimina una valutazione
   */
  deleteEvaluation(id: string): Observable<boolean> {
    return this.mutate<{ deletePatientEvaluation: boolean }>(
      DELETE_PATIENT_EVALUATION,
      { id }
    ).pipe(map((result) => result.deletePatientEvaluation));
  }

  // ==================== DOCUMENT MUTATIONS ====================

  /**
   * Crea un nuovo documento
   */
  createDocument(input: CreateDocumentInput): Observable<PathDocument> {
    return this.mutate<{ createPathDocument: BackendPathDocument }>(
      CREATE_PATH_DOCUMENT,
      { input }
    ).pipe(map((result) => this.mapBackendDocument(result.createPathDocument)));
  }

  /**
   * Elimina un documento
   */
  deleteDocument(id: string): Observable<boolean> {
    return this.mutate<{ deletePathDocument: boolean }>(
      DELETE_PATH_DOCUMENT,
      { id }
    ).pipe(map((result) => result.deletePathDocument));
  }
}
