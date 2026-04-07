/**
 * Instructor Workspace Service
 * Layer 3: Business Logic
 *
 * Responsabilità:
 * - Caricamento appuntamenti palestra per istruttore (con fragment gymRoom)
 * - Delega a services esistenti per operatori, trattamenti, percorsi
 */

import { Injectable, Injector } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { BaseGraphQLService } from '../../../core/services/base-graphql.service';
import { OperatorService } from '../../../services/operator.service';
import { AvailabilityAppointment, Operator, OperatorMacroCategory } from '../../../graphql/generated/types';
import { GET_INSTRUCTOR_APPOINTMENTS } from '../../../graphql/operations/instructor-appointment.queries';

export interface InstructorLoadResult {
  operators: Operator[];
  error?: string;
}

export interface InstructorAppointmentsResult {
  appointments: AvailabilityAppointment[];
  error?: string;
}

@Injectable({
  providedIn: 'root',
})
export class InstructorWorkspaceService extends BaseGraphQLService {
  constructor(
    injector: Injector,
    private operatorService: OperatorService,
  ) {
    super(injector);
  }

  /**
   * Carica solo operatori con macroCategory GYM_INSTRUCTOR
   */
  loadInstructors(): Observable<InstructorLoadResult> {
    return this.operatorService
      .getOperators(OperatorMacroCategory.GymInstructor, undefined, true)
      .pipe(
        map((operators) => ({ operators })),
        catchError((error) => {
          console.error('[InstructorWorkspaceService] Errore caricamento istruttori:', error);
          return of({ operators: [], error: 'Errore nel caricamento degli istruttori' });
        }),
      );
  }

  /**
   * Carica appuntamenti palestra per un istruttore in un range di date.
   * Usa GymAppointmentFields che include gymRoomId e gymRoom.
   */
  loadAppointments(
    operatorId: string,
    startDate: string,
    endDate: string,
  ): Observable<InstructorAppointmentsResult> {
    return this.query<{ availabilityAppointmentsByOperator: AvailabilityAppointment[] }>(
      GET_INSTRUCTOR_APPOINTMENTS,
      { operatorId, startDate, endDate },
    ).pipe(
      map((result) => ({
        appointments: result.availabilityAppointmentsByOperator || [],
      })),
      catchError((error) => {
        console.error('[InstructorWorkspaceService] Errore caricamento appuntamenti:', error);
        return of({ appointments: [], error: 'Errore nel caricamento degli appuntamenti' });
      }),
    );
  }
}
