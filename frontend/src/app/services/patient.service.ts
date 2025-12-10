import { Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Observable, map } from 'rxjs';
import { Patient } from '../models/patient.model';
import { GET_PATIENTS, GET_PATIENT, SEARCH_PATIENTS } from '../graphql/operations/patient.queries';
import { CREATE_PATIENT, UPDATE_PATIENT } from '../graphql/operations/patient.mutations';

@Injectable({
  providedIn: 'root',
})
export class PatientService {
  constructor(private apollo: Apollo) {}

  /**
   * Ottiene tutti i pazienti con paginazione opzionale
   */
  getPatients(limit?: number, offset?: number): Observable<Patient[]> {
    return this.apollo
      .query<{ patients: Patient[] }>({
        query: GET_PATIENTS,
        variables: { limit: limit || 1000, offset: offset || 0 },
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => result.data?.patients || []));
  }

  /**
   * Ottiene un singolo paziente per ID
   */
  getPatient(id: number): Observable<Patient | null> {
    return this.apollo
      .query<{ patient: Patient | null }>({
        query: GET_PATIENT,
        variables: { id: String(id) },
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => result.data?.patient || null));
  }

  /**
   * Cerca pazienti per termine di ricerca (nome, cognome, telefono)
   * Usa nomeCompleto per cercare su nome e cognome insieme
   */
  searchPatients(searchTerm: string): Observable<Patient[]> {
    return this.apollo
      .query<{ searchPatients: Patient[] }>({
        query: SEARCH_PATIENTS,
        variables: {
          searchInput: {
            nomeCompleto: searchTerm,
            limit: 50,
          },
        },
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => result.data?.searchPatients || []));
  }

  /**
   * Crea un nuovo paziente
   */
  createPatient(patient: Partial<Patient>): Observable<Patient> {
    return this.apollo
      .mutate<{ createPatient: Patient }>({
        mutation: CREATE_PATIENT,
        variables: { input: patient },
        refetchQueries: [{ query: GET_PATIENTS }],
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error('Failed to create patient');
          }
          return result.data.createPatient;
        })
      );
  }

  /**
   * Aggiorna un paziente esistente
   */
  updatePatient(id: number, patient: Partial<Patient>): Observable<Patient> {
    return this.apollo
      .mutate<{ updatePatient: Patient }>({
        mutation: UPDATE_PATIENT,
        variables: { id: String(id), input: patient },
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error('Failed to update patient');
          }
          return result.data.updatePatient;
        })
      );
  }
}
