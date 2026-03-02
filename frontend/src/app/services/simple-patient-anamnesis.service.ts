/**
 * Simple Patient Anamnesis Service
 *
 * Service per la NUOVA anamnesi paziente semplice (legata direttamente a Patient, non a TherapeuticPath)
 *
 * Contiene solo:
 * - Patologie pregresse
 * - Interventi chirurgici
 * - Traumi
 * - Terapia farmacologica
 * - Allergie (NUOVO)
 * - Storia familiare (NUOVO)
 * - Note
 *
 * NON confondere con PatientEvaluationService (ex PatientAnamnesisService)
 * che gestisce la valutazione completa del percorso terapeutico.
 */
import { Injectable, Injector } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BaseGraphQLService } from '../core/services/base-graphql.service';
import {
  PatientAnamnesis,
  CreatePatientAnamnesisInput,
  UpdatePatientAnamnesisInput,
} from '../features/operators-new/models/patient-anamnesis.model';

// Queries
import {
  GET_SIMPLE_PATIENT_ANAMNESIS,
  GET_PATIENT_ANAMNESIS_BY_PATIENT,
  HAS_PATIENT_ANAMNESIS,
} from '../graphql/operations/simple-patient-anamnesis.queries';

// Mutations
import {
  CREATE_PATIENT_ANAMNESIS,
  UPDATE_PATIENT_ANAMNESIS,
  UPSERT_PATIENT_ANAMNESIS,
  DELETE_PATIENT_ANAMNESIS,
} from '../graphql/operations/simple-patient-anamnesis.mutations';

// ==================== BACKEND TYPES (from GraphQL) ====================

interface BackendPatientAnamnesis {
  id: string;
  patientId: string;
  operatorId?: string;

  patologiePregresse?: string;
  interventiChirurgici?: string;
  traumi?: string;
  terapiaFarmacologica?: string[];
  allergie?: string;
  storiaFamiliare?: string;
  note?: string;

  createdAt: string;
  updatedAt: string;

  operator?: {
    id: string;
    name: string;
    surname: string;
  };
}

// ==================== SERVICE ====================

@Injectable({
  providedIn: 'root',
})
export class SimplePatientAnamnesisService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  // ==================== HELPER FUNCTIONS ====================

  /**
   * Converte l'anamnesi backend nel formato frontend
   */
  private mapBackendToFrontend(backend: BackendPatientAnamnesis): PatientAnamnesis {
    return {
      id: backend.id,
      patientId: backend.patientId,

      patologiePregresse: backend.patologiePregresse ?? null,
      interventiChirurgici: backend.interventiChirurgici ?? null,
      traumi: backend.traumi ?? null,
      terapiaFarmacologica: backend.terapiaFarmacologica ?? [],
      allergie: backend.allergie ?? null,
      storiaFamiliare: backend.storiaFamiliare ?? null,
      note: backend.note ?? null,

      createdAt: backend.createdAt,
      updatedAt: backend.updatedAt,
      operatorId: backend.operatorId,
      operatorName: backend.operator
        ? `${backend.operator.name} ${backend.operator.surname}`.trim()
        : undefined,
    };
  }

  /**
   * Converte anamnesi frontend in input per creazione
   */
  mapToCreateInput(anamnesis: Partial<PatientAnamnesis>, patientId: string, operatorId?: string): CreatePatientAnamnesisInput {
    return {
      patientId,
      operatorId,
      patologiePregresse: anamnesis.patologiePregresse ?? undefined,
      interventiChirurgici: anamnesis.interventiChirurgici ?? undefined,
      traumi: anamnesis.traumi ?? undefined,
      terapiaFarmacologica: anamnesis.terapiaFarmacologica,
      allergie: anamnesis.allergie ?? undefined,
      storiaFamiliare: anamnesis.storiaFamiliare ?? undefined,
      note: anamnesis.note ?? undefined,
    };
  }

  /**
   * Converte anamnesi frontend in input per aggiornamento
   */
  mapToUpdateInput(anamnesis: Partial<PatientAnamnesis>, operatorId?: string): UpdatePatientAnamnesisInput {
    return {
      operatorId,
      patologiePregresse: anamnesis.patologiePregresse ?? undefined,
      interventiChirurgici: anamnesis.interventiChirurgici ?? undefined,
      traumi: anamnesis.traumi ?? undefined,
      terapiaFarmacologica: anamnesis.terapiaFarmacologica,
      allergie: anamnesis.allergie ?? undefined,
      storiaFamiliare: anamnesis.storiaFamiliare ?? undefined,
      note: anamnesis.note ?? undefined,
    };
  }

  // ==================== QUERIES ====================

  /**
   * Ottiene l'anamnesi per ID
   */
  getAnamnesis(id: string): Observable<PatientAnamnesis | null> {
    return this.query<{ patientAnamnesis: BackendPatientAnamnesis | null }>(
      GET_SIMPLE_PATIENT_ANAMNESIS,
      { id }
    ).pipe(
      map((result) =>
        result.patientAnamnesis
          ? this.mapBackendToFrontend(result.patientAnamnesis)
          : null
      )
    );
  }

  /**
   * Ottiene l'anamnesi di un paziente dato il patientId
   */
  getAnamnesisByPatient(patientId: string): Observable<PatientAnamnesis | null> {
    return this.query<{ patientAnamnesisByPatient: BackendPatientAnamnesis | null }>(
      GET_PATIENT_ANAMNESIS_BY_PATIENT,
      { patientId }
    ).pipe(
      map((result) =>
        result.patientAnamnesisByPatient
          ? this.mapBackendToFrontend(result.patientAnamnesisByPatient)
          : null
      )
    );
  }

  /**
   * Verifica se un paziente ha un'anamnesi
   */
  hasAnamnesis(patientId: string): Observable<boolean> {
    return this.query<{ hasPatientAnamnesis: boolean }>(
      HAS_PATIENT_ANAMNESIS,
      { patientId }
    ).pipe(map((result) => result.hasPatientAnamnesis));
  }

  // ==================== MUTATIONS ====================

  /**
   * Crea una nuova anamnesi per un paziente
   */
  createAnamnesis(input: CreatePatientAnamnesisInput): Observable<PatientAnamnesis> {
    return this.mutate<{ createPatientAnamnesis: BackendPatientAnamnesis }>(
      CREATE_PATIENT_ANAMNESIS,
      { input }
    ).pipe(
      map((result) => this.mapBackendToFrontend(result.createPatientAnamnesis))
    );
  }

  /**
   * Aggiorna un'anamnesi esistente
   */
  updateAnamnesis(id: string, input: UpdatePatientAnamnesisInput): Observable<PatientAnamnesis> {
    return this.mutate<{ updatePatientAnamnesis: BackendPatientAnamnesis }>(
      UPDATE_PATIENT_ANAMNESIS,
      { id, input }
    ).pipe(
      map((result) => this.mapBackendToFrontend(result.updatePatientAnamnesis))
    );
  }

  /**
   * Crea o aggiorna l'anamnesi di un paziente (upsert)
   * Utile quando non si sa se esiste già o meno
   */
  upsertAnamnesis(patientId: string, input: UpdatePatientAnamnesisInput): Observable<PatientAnamnesis> {
    return this.mutate<{ upsertPatientAnamnesis: BackendPatientAnamnesis }>(
      UPSERT_PATIENT_ANAMNESIS,
      { patientId, input }
    ).pipe(
      map((result) => this.mapBackendToFrontend(result.upsertPatientAnamnesis))
    );
  }

  /**
   * Elimina un'anamnesi
   */
  deleteAnamnesis(id: string): Observable<boolean> {
    return this.mutate<{ deletePatientAnamnesis: boolean }>(
      DELETE_PATIENT_ANAMNESIS,
      { id }
    ).pipe(map((result) => result.deletePatientAnamnesis));
  }
}
