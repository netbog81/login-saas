import { Injectable, Injector } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BaseGraphQLService } from '../core/services/base-graphql.service';
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
export class ConflictService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  /**
   * Ottiene appuntamenti in conflitto con filtri opzionali
   */
  getConflictedAppointments(
    filters?: ConflictFilters
  ): Observable<AvailabilityAppointment[]> {
    return this.query<{ conflictedAppointments: AvailabilityAppointment[] }>(
      GET_CONFLICTED_APPOINTMENTS,
      {
        operatorId: filters?.operatorId,
        dateFrom: filters?.dateFrom,
        dateTo: filters?.dateTo,
        conflictReason: filters?.conflictReason,
      }
    ).pipe(
      map((result) => result.conflictedAppointments || [])
    );
  }

  /**
   * Ottiene statistiche sui conflitti
   */
  getConflictStats(): Observable<ConflictStatsOutput> {
    return this.query<{ conflictStats: ConflictStatsOutput }>(
      GET_CONFLICT_STATS
    ).pipe(
      map((result) => result.conflictStats ?? {
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
    return this.query<{ conflictedAppointmentsCount: number }>(
      GET_CONFLICTED_APPOINTMENTS_COUNT
    ).pipe(
      map((result) => result.conflictedAppointmentsCount || 0)
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
    return this.mutate<{ resolveAppointmentConflict: AvailabilityAppointment }>(
      RESOLVE_APPOINTMENT_CONFLICT,
      {
        appointmentId,
        action,
        resolvedBy,
        newDate: options?.newDate,
        newStartTime: options?.newStartTime,
        newEndTime: options?.newEndTime,
        notes: options?.notes,
      },
      [
        { query: GET_CONFLICTED_APPOINTMENTS },
        { query: GET_CONFLICT_STATS },
        { query: GET_CONFLICTED_APPOINTMENTS_COUNT },
      ]
    ).pipe(
      map((result) => {
        if (!result.resolveAppointmentConflict) {
          throw new Error('Failed to resolve conflict');
        }
        return result.resolveAppointmentConflict;
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
    return this.mutate<{ resolveMultipleConflicts: AvailabilityAppointment[] }>(
      RESOLVE_MULTIPLE_CONFLICTS,
      {
        appointmentIds,
        action,
        resolvedBy,
        notes,
      },
      [
        { query: GET_CONFLICTED_APPOINTMENTS },
        { query: GET_CONFLICT_STATS },
        { query: GET_CONFLICTED_APPOINTMENTS_COUNT },
      ]
    ).pipe(
      map((result) => {
        if (!result.resolveMultipleConflicts) {
          throw new Error('Failed to resolve conflicts');
        }
        return result.resolveMultipleConflicts;
      })
    );
  }
}
