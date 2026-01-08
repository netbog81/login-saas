import { Injectable, Injector } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Patient } from '../models/patient.model';
import { GET_PATIENTS, GET_PATIENT, SEARCH_PATIENTS } from '../graphql/operations/patient.queries';
import { CREATE_PATIENT, UPDATE_PATIENT } from '../graphql/operations/patient.mutations';
import { BaseGraphQLService } from '../core/services/base-graphql.service';

@Injectable({
  providedIn: 'root',
})
export class PatientService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  /**
   * Ottiene tutti i pazienti con paginazione opzionale
   */
  getPatients(limit?: number, offset?: number): Observable<Patient[]> {
    return this.query<{ patients: Patient[] }>(
      GET_PATIENTS,
      { limit: limit || 1000, offset: offset || 0 }
    ).pipe(map((result) => result.patients || []));
  }

  /**
   * Ottiene un singolo paziente per ID
   */
  getPatient(id: number): Observable<Patient | null> {
    return this.query<{ patient: Patient | null }>(
      GET_PATIENT,
      { id: String(id) }
    ).pipe(map((result) => result.patient || null));
  }

  /**
   * Cerca pazienti per termine di ricerca (nome, cognome, telefono)
   * Usa nomeCompleto per cercare su nome e cognome insieme
   */
  searchPatients(searchTerm: string): Observable<Patient[]> {
    return this.query<{ searchPatients: Patient[] }>(
      SEARCH_PATIENTS,
      { searchInput: { nomeCompleto: searchTerm, limit: 50 } }
    ).pipe(map((result) => result.searchPatients || []));
  }

  /**
   * Crea un nuovo paziente
   */
  createPatient(patient: Partial<Patient>): Observable<Patient> {
    return this.mutate<{ createPatient: Patient }>(
      CREATE_PATIENT,
      { createPatientInput: patient },
      [{ query: GET_PATIENTS }]
    ).pipe(map((result) => result.createPatient));
  }

  /**
   * Aggiorna un paziente esistente
   */
  updatePatient(id: number, patient: Partial<Patient>): Observable<Patient> {
    return this.mutate<{ updatePatient: Patient }>(
      UPDATE_PATIENT,
      { id: String(id), updatePatientInput: patient }
    ).pipe(map((result) => result.updatePatient));
  }
}
