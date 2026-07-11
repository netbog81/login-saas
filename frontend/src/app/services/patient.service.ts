import { Injectable, Injector } from '@angular/core';
import { Observable, map } from 'rxjs';

import {
  buildAddressesFromFlat,
  buildContactsFromFlat,
  buildCreatePatientInput,
  CreatePatientInput,
  mapApiPatientToFlat,
  mapLegalCapacityToRegistry,
  Patient,
  PatientSearchParams,
  UpdatePatientAnamnesisInput,
  UpdateRegistryIndividualInput,
} from '../models/patient.model';
import {
  GET_PATIENT,
  SEARCH_PATIENTS,
} from '../graphql/operations/patient.queries';
import {
  CREATE_PATIENT,
  RECORD_PATIENT_ATTENDANCE,
  SET_PATIENT_PRIVACY_CONSENT,
  UPDATE_PATIENT_ANAMNESIS,
  UPDATE_PATIENT_REGISTRY,
} from '../graphql/operations/patient.mutations';
import { BaseGraphQLService } from '../core/services/base-graphql.service';

interface SearchPatientsResult {
  searchPatients: {
    data: Patient[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

@Injectable({
  providedIn: 'root',
})
export class PatientService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  /**
   * Lista paginata via global-search del registry.
   * limit/offset sono mappati a pageSize/page per back-compat con il vecchio service.
   */
  getPatients(limit?: number, offset?: number): Observable<Patient[]> {
    // pageSize è cappato a 100: è il massimo consentito dal registry
    // (search-subjects.dto.ts). Valori superiori → HTTP 400 "pageSize must
    // not be greater than 100". Per il CONTEGGIO totale usare invece
    // countPatients()/searchPatientsRaw(...).total, che non scarica i record.
    const requested = limit && limit > 0 ? limit : 50;
    const pageSize = Math.min(requested, 100);
    const page = offset && offset > 0 ? Math.floor(offset / pageSize) + 1 : 1;
    return this.searchPatientsRaw({ pageSize, page, isActive: true }).pipe(
      map((res) => res.data),
    );
  }

  /**
   * Conteggio totale dei pazienti attivi senza scaricare i record.
   * Usa il metadato `total` della global-search del registry (pageSize=1).
   */
  countPatients(): Observable<number> {
    return this.searchPatientsRaw({ pageSize: 1, page: 1, isActive: true }).pipe(
      map((res) => res.total),
    );
  }

  getPatient(id: string): Observable<Patient | null> {
    return this.query<{ patient: Patient | null }>(GET_PATIENT, { id }).pipe(
      map((result) => mapApiPatientToFlat(result.patient)),
    );
  }

  searchPatients(searchTerm: string): Observable<Patient[]> {
    // pageSize 100 = max consentito dal registry (vedi search-subjects.dto.ts).
    return this.searchPatientsRaw({
      query: searchTerm,
      page: 1,
      pageSize: 100,
      isActive: true,
    }).pipe(map((res) => res.data));
  }

  /**
   * Versione raw che ritorna anche i metadati di paginazione.
   */
  searchPatientsRaw(params: PatientSearchParams): Observable<{
    data: Patient[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const input = {
      query: params.query ?? params.search,
      isActive: params.isActive,
      page:
        params.page ??
        (params.offset && params.limit ? Math.floor(params.offset / params.limit) + 1 : 1),
      pageSize: params.pageSize ?? params.limit ?? 25,
      subjectType: 'INDIVIDUAL',
    };
    return this.query<SearchPatientsResult>(SEARCH_PATIENTS, { input }).pipe(
      map((result) => ({
        data: (result.searchPatients.data || [])
          .map((p) => mapApiPatientToFlat(p)!)
          .filter(Boolean)
          // Ordine alfabetico per cognome+nome. Il registry restituisce già la
          // pagina ordinata (colonna sortKey), ma la sortKey usa un prefisso
          // normalizzato/troncato: qui ri-ordiniamo la pagina ricevuta con il
          // nome completo per una resa perfetta e indipendente dal backend.
          .sort((a, b) =>
            `${a.cognome ?? ''} ${a.nome ?? ''}`.trim()
              .localeCompare(`${b.cognome ?? ''} ${b.nome ?? ''}`.trim(), 'it', { sensitivity: 'base' }),
          ),
        total: result.searchPatients.total,
        page: result.searchPatients.page,
        pageSize: result.searchPatients.pageSize,
        totalPages: result.searchPatients.totalPages,
      })),
    );
  }

  /**
   * Crea un paziente.
   * Accetta sia il nuovo `CreatePatientInput` strutturato che il vecchio shape
   * piatto (Partial<Patient>): in quest'ultimo caso converte via helper.
   */
  createPatient(payload: CreatePatientInput | Partial<Patient>): Observable<Patient> {
    const input: CreatePatientInput =
      'registry' in payload && payload.registry
        ? (payload as CreatePatientInput)
        : buildCreatePatientInput(this.toFlatLikeForCreate(payload as Partial<Patient>));
    return this.mutate<{ createPatient: Patient }>(CREATE_PATIENT, { input }).pipe(
      map((result) => mapApiPatientToFlat(result.createPatient)!),
    );
  }

  /**
   * Aggiorna i campi anagrafici (vanno al registry). Per dati clinici (allergie,
   * gruppo sanguigno, ...) usare updatePatientAnamnesis().
   */
  updatePatientRegistry(id: string, input: UpdateRegistryIndividualInput): Observable<Patient> {
    return this.mutate<{ updatePatientRegistry: Patient }>(UPDATE_PATIENT_REGISTRY, {
      id,
      input,
    }).pipe(map((result) => mapApiPatientToFlat(result.updatePatientRegistry)!));
  }

  /**
   * Compat: vecchio updatePatient. Mappa i campi piatti a UpdateRegistryIndividualInput.
   *
   * NOTA shape: il registry sostituisce per intero gli array `contacts` e
   * `addresses` quando li riceve. Quindi se l'utente ha modificato anche solo
   * uno fra telefono/cellulare/email, dobbiamo inviare l'array completo dei
   * contatti correnti, altrimenti perdiamo gli altri.
   *
   * Per aggiornare l'anamnesi clinica usare updatePatientAnamnesis().
   */
  updatePatient(id: string, p: Partial<Patient>): Observable<Patient> {
    const registryInput: UpdateRegistryIndividualInput = {};
    if (p.nome !== undefined) registryInput.firstName = p.nome;
    if (p.cognome !== undefined) registryInput.lastName = p.cognome;
    if (p.codiceFiscale !== undefined) registryInput.taxCode = p.codiceFiscale;
    if (p.dataNascita !== undefined) {
      registryInput.birthDate =
        typeof p.dataNascita === 'string'
          ? p.dataNascita
          : p.dataNascita?.toISOString().split('T')[0];
    }
    if (p.genere !== undefined) {
      // mapGenereToRegistry è interno al model, ma replico la logica qui
      const g = (p.genere || '').toUpperCase();
      if (g === 'M' || g === 'MASCHIO' || g === 'MALE') registryInput.gender = 'M';
      else if (g === 'F' || g === 'FEMMINA' || g === 'FEMALE') registryInput.gender = 'F';
      else if (g) registryInput.gender = 'X';
    }
    if (p.tipoPaziente !== undefined) {
      registryInput.legalCapacity = mapLegalCapacityToRegistry(p.tipoPaziente as string);
    }

    // Se ALMENO uno dei campi contatto è presente nel payload (anche stringa
    // vuota = utente l'ha cancellato), ricostruisco l'array contacts intero.
    // Questo replace-style è il contratto del registry.
    const hasContactField =
      p.telefono !== undefined ||
      p.cellulare !== undefined ||
      p.email !== undefined ||
      p.pec !== undefined ||
      p.fax !== undefined;
    if (hasContactField) {
      registryInput.contacts = buildContactsFromFlat({
        telefono: p.telefono,
        cellulare: p.cellulare,
        email: p.email,
        pec: p.pec,
        fax: p.fax,
      });
    }

    // Stesso ragionamento per gli indirizzi.
    const hasAddressField =
      p.indirizzo !== undefined ||
      p.citta !== undefined ||
      p.cap !== undefined ||
      p.provincia !== undefined ||
      p.nazioneResidenza !== undefined;
    if (hasAddressField) {
      registryInput.addresses = buildAddressesFromFlat({
        indirizzo: p.indirizzo,
        citta: p.citta,
        cap: p.cap,
        provincia: p.provincia,
        nazioneResidenza: p.nazioneResidenza,
      });
    }

    return this.updatePatientRegistry(id, registryInput);
  }

  updatePatientAnamnesis(
    subjectId: string,
    input: UpdatePatientAnamnesisInput,
  ): Observable<unknown> {
    // NB: lo schema GraphQL ora chiama l'arg `id` (non `subjectId`).
    // Il valore semantico è lo stesso (subjectId del registry); manteniamo
    // il nome del parametro TS `subjectId` per compatibilità coi caller,
    // ma rinominiamo la chiave delle variables a `id`.
    return this.mutate(UPDATE_PATIENT_ANAMNESIS, { id: subjectId, input });
  }

  setPatientPrivacyConsent(
    id: string,
    given: boolean,
    documentRef?: string,
  ): Observable<Patient> {
    return this.mutate<{ setPatientPrivacyConsent: Patient }>(
      SET_PATIENT_PRIVACY_CONSENT,
      { id, given, documentRef },
    ).pipe(map((result) => mapApiPatientToFlat(result.setPatientPrivacyConsent)!));
  }

  recordAttendance(
    subjectId: string,
    eventType: 'NO_SHOW' | 'CANCELLATION',
    reason?: string,
    appointmentId?: string,
  ): Observable<boolean> {
    return this.mutate<{ recordPatientAttendance: boolean }>(
      RECORD_PATIENT_ATTENDANCE,
      { subjectId, eventType, reason, appointmentId },
    ).pipe(map((r) => r.recordPatientAttendance));
  }

  // ==================== HELPERS ====================

  private toFlatLikeForCreate(p: Partial<Patient>): Parameters<typeof buildCreatePatientInput>[0] {
    return {
      nome: p.nome ?? '',
      cognome: p.cognome ?? '',
      codiceFiscale: p.codiceFiscale,
      dataNascita:
        typeof p.dataNascita === 'string'
          ? p.dataNascita
          : p.dataNascita?.toISOString().split('T')[0],
      genere: p.genere,
      telefono: p.telefono,
      cellulare: p.cellulare,
      email: p.email,
      indirizzo: p.indirizzo,
      citta: p.citta,
      cap: p.cap,
      provincia: p.provincia,
      legalCapacity: p.tipoPaziente as string,
      notes: p.notes,
    };
  }
}
