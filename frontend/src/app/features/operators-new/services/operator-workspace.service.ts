/**
 * Operator Workspace Service
 * Layer 3: Business Logic
 *
 * Responsabilità:
 * - Orchestrazione caricamento dati workspace
 * - Aggregazione chiamate GraphQL
 * - Logica business del workspace
 */

import { Injectable, Injector } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { BaseGraphQLService } from '../../../core/services/base-graphql.service';
import { OperatorService } from '../../../services/operator.service';
import { AvailabilityAppointmentService } from '../../../services/availability-appointment.service';
import { PatientService } from '../../../services/patient.service';
import { Operator, AvailabilityAppointment } from '../../../graphql/generated/types';
import { Patient } from '../../../models/patient.model';

export interface WorkspaceLoadResult {
  operators: Operator[];
  error?: string;
}

export interface AppointmentsLoadResult {
  appointments: AvailabilityAppointment[];
  error?: string;
}

export interface PatientLoadResult {
  patient: Patient | null;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class OperatorWorkspaceService extends BaseGraphQLService {

  constructor(
    injector: Injector,
    private operatorService: OperatorService,
    private appointmentService: AvailabilityAppointmentService,
    private patientService: PatientService
  ) {
    super(injector);
  }

  /**
   * Carica tutti gli operatori
   */
  loadOperators(): Observable<WorkspaceLoadResult> {
    return this.operatorService.getOperators().pipe(
      map(operators => ({ operators })),
      catchError(error => {
        console.error('[OperatorWorkspaceService] Errore caricamento operatori:', error);
        return of({ operators: [], error: 'Errore nel caricamento degli operatori' });
      })
    );
  }

  /**
   * Carica appuntamenti per operatore e data
   */
  loadAppointments(operatorId: string, date: Date): Observable<AppointmentsLoadResult> {
    const dateStr = this.formatDate(date);

    return this.appointmentService.getAppointmentsByOperator(operatorId, dateStr, dateStr).pipe(
      map(appointments => ({
        appointments: this.sortAppointmentsByTime(appointments)
      })),
      catchError(error => {
        console.error('[OperatorWorkspaceService] Errore caricamento appuntamenti:', error);
        return of({ appointments: [], error: 'Errore nel caricamento degli appuntamenti' });
      })
    );
  }

  /**
   * Carica dati paziente
   */
  loadPatient(patientId: number): Observable<PatientLoadResult> {
    return this.patientService.getPatient(patientId).pipe(
      map(patient => ({ patient })),
      catchError(error => {
        console.error('[OperatorWorkspaceService] Errore caricamento paziente:', error);
        return of({ patient: null, error: 'Errore nel caricamento del paziente' });
      })
    );
  }

  /**
   * Ordina appuntamenti per orario
   */
  private sortAppointmentsByTime(appointments: AvailabilityAppointment[]): AvailabilityAppointment[] {
    return [...appointments].sort((a, b) => {
      const timeA = a.startTime || '00:00';
      const timeB = b.startTime || '00:00';
      return timeA.localeCompare(timeB);
    });
  }

  /**
   * Formatta data in YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
