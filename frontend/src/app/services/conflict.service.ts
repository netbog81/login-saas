import { Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Observable, map } from 'rxjs';
import {
  AvailabilityAppointment,
  ConflictStatsOutput,
  ConflictReason,
  ConflictResolutionAction,
} from '../graphql/generated/types';
import {
  GET_CONFLICTED_APPOINTMENTS,
  GET_CONFLICT_STATS,
  GET_CONFLICTED_APPOINTMENTS_COUNT,
  RESOLVE_APPOINTMENT_CONFLICT,
  RESOLVE_MULTIPLE_CONFLICTS,
} from '../graphql/operations/conflict.queries';

export interface ConflictFilters {
  operatorId?: string;
  dateFrom?: string;
  dateTo?: string;
  conflictReason?: ConflictReason;
}

@Injectable({
  providedIn: 'root',
})
export class ConflictService {
  constructor(private apollo: Apollo) {}

  /**
   * Ottiene appuntamenti in conflitto con filtri opzionali
   */
  getConflictedAppointments(
    filters?: ConflictFilters
  ): Observable<AvailabilityAppointment[]> {
    return this.apollo
      .query<{ conflictedAppointments: AvailabilityAppointment[] }>({
        query: GET_CONFLICTED_APPOINTMENTS,
        variables: {
          operatorId: filters?.operatorId,
          dateFrom: filters?.dateFrom,
          dateTo: filters?.dateTo,
          conflictReason: filters?.conflictReason,
        },
        fetchPolicy: 'network-only',
      })
      .pipe(
        map((result) => result.data?.conflictedAppointments || [])
      );
  }

  /**
   * Ottiene statistiche sui conflitti
   */
  getConflictStats(): Observable<ConflictStatsOutput> {
    return this.apollo
      .query<{ conflictStats: ConflictStatsOutput }>({
        query: GET_CONFLICT_STATS,
        fetchPolicy: 'network-only',
      })
      .pipe(
        map((result) => result.data?.conflictStats ?? {
          totalConflicts: 0,
          byReason: {},
          byOperator: []
        })
      );
  }

  /**
   * Ottiene il conteggio dei conflitti (per badge/notifiche)
   */
  getConflictedAppointmentsCount(): Observable<number> {
    return this.apollo
      .query<{ conflictedAppointmentsCount: number }>({
        query: GET_CONFLICTED_APPOINTMENTS_COUNT,
        fetchPolicy: 'network-only',
      })
      .pipe(
        map((result) => result.data?.conflictedAppointmentsCount || 0)
      );
  }

  /**
   * Risolve un singolo conflitto
   */
  resolveConflict(
    appointmentId: string,
    action: ConflictResolutionAction,
    resolvedBy: string,
    options?: {
      newDate?: string;
      newStartTime?: string;
      newEndTime?: string;
      notes?: string;
    }
  ): Observable<AvailabilityAppointment> {
    return this.apollo
      .mutate<{ resolveAppointmentConflict: AvailabilityAppointment }>({
        mutation: RESOLVE_APPOINTMENT_CONFLICT,
        variables: {
          appointmentId,
          action,
          resolvedBy,
          newDate: options?.newDate,
          newStartTime: options?.newStartTime,
          newEndTime: options?.newEndTime,
          notes: options?.notes,
        },
        refetchQueries: [
          { query: GET_CONFLICTED_APPOINTMENTS },
          { query: GET_CONFLICT_STATS },
          { query: GET_CONFLICTED_APPOINTMENTS_COUNT },
        ],
        awaitRefetchQueries: true,
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error('Failed to resolve conflict');
          }
          return result.data.resolveAppointmentConflict;
        })
      );
  }

  /**
   * Risolve multipli conflitti con la stessa azione
   * Nota: RESCHEDULE non supportato per batch
   */
  resolveMultipleConflicts(
    appointmentIds: string[],
    action: ConflictResolutionAction.Keep | ConflictResolutionAction.Cancel,
    resolvedBy: string,
    notes?: string
  ): Observable<AvailabilityAppointment[]> {
    return this.apollo
      .mutate<{ resolveMultipleConflicts: AvailabilityAppointment[] }>({
        mutation: RESOLVE_MULTIPLE_CONFLICTS,
        variables: {
          appointmentIds,
          action,
          resolvedBy,
          notes,
        },
        refetchQueries: [
          { query: GET_CONFLICTED_APPOINTMENTS },
          { query: GET_CONFLICT_STATS },
          { query: GET_CONFLICTED_APPOINTMENTS_COUNT },
        ],
        awaitRefetchQueries: true,
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error('Failed to resolve conflicts');
          }
          return result.data.resolveMultipleConflicts;
        })
      );
  }
}
