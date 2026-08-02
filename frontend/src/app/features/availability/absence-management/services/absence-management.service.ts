import { Injectable, Injector } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BaseGraphQLService } from '../../../../core/services/base-graphql.service';
import {
  GET_OPERATOR_ABSENCES,
  PREVIEW_OPERATOR_ABSENCE_IMPACT,
  CREATE_OPERATOR_ABSENCES,
  DELETE_ABSENCE,
  DELETE_ABSENCE_GROUP,
  PREVIEW_OPERATOR_AVAILABILITY_IMPACT,
  CREATE_OPERATOR_AVAILABILITY,
  PREVIEW_AVAILABILITY_REMOVAL_IMPACT,
  PREVIEW_GROUP_REMOVAL_IMPACT,
  DELETE_EXCEPTION_GROUP,
  PREVIEW_SCHEDULE_CHANGE_IMPACT,
  CREATE_SCHEDULE_CHANGE,
} from '../graphql/absence.operations';
import {
  OperatorAbsence,
  AbsenceImpactPreview,
  CreateOperatorAbsencesInput,
  OperatorAbsencesResult,
  CreateOperatorAvailabilityInput,
  AvailabilityImpactPreview,
  ExtraAvailabilityResult,
  AvailabilityRemovalResult,
  ImpactedAppointment,
  CreateScheduleChangeInput,
  ScheduleChangeImpactPreview,
  ScheduleChangeResult,
} from '../models/absence.model';

@Injectable({ providedIn: 'root' })
export class AbsenceManagementService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  list(params: {
    operatorId?: string;
    startDate?: string;
    endDate?: string;
  }): Observable<OperatorAbsence[]> {
    return this.query<{ availabilityExceptions: OperatorAbsence[] }>(
      GET_OPERATOR_ABSENCES,
      params,
    ).pipe(map((r) => r.availabilityExceptions || []));
  }

  previewImpact(params: {
    operatorIds: string[];
    dateFrom: string;
    dateTo: string;
    startTime?: string;
    endTime?: string;
  }): Observable<AbsenceImpactPreview> {
    return this.query<{ previewOperatorAbsenceImpact: AbsenceImpactPreview }>(
      PREVIEW_OPERATOR_ABSENCE_IMPACT,
      params,
    ).pipe(map((r) => r.previewOperatorAbsenceImpact));
  }

  createAbsences(input: CreateOperatorAbsencesInput): Observable<OperatorAbsencesResult> {
    return this.mutate<{ createOperatorAbsences: OperatorAbsencesResult }>(
      CREATE_OPERATOR_ABSENCES,
      { input },
    ).pipe(map((r) => r.createOperatorAbsences));
  }

  deleteAbsence(id: string): Observable<boolean> {
    return this.mutate<{ deleteException: boolean }>(DELETE_ABSENCE, { id }).pipe(
      map((r) => r.deleteException),
    );
  }

  deleteAbsenceGroup(sourceGroupId: string): Observable<number> {
    return this.mutate<{ deleteAbsenceGroup: number }>(DELETE_ABSENCE_GROUP, {
      sourceGroupId,
    }).pipe(map((r) => r.deleteAbsenceGroup));
  }

  // ============ DISPONIBILITÀ STRAORDINARIE ============

  previewAvailabilityImpact(
    input: CreateOperatorAvailabilityInput,
  ): Observable<AvailabilityImpactPreview> {
    return this.query<{ previewOperatorAvailabilityImpact: AvailabilityImpactPreview }>(
      PREVIEW_OPERATOR_AVAILABILITY_IMPACT,
      { input },
    ).pipe(map((r) => r.previewOperatorAvailabilityImpact));
  }

  createAvailability(
    input: CreateOperatorAvailabilityInput,
  ): Observable<ExtraAvailabilityResult> {
    return this.mutate<{ createOperatorAvailability: ExtraAvailabilityResult }>(
      CREATE_OPERATOR_AVAILABILITY,
      { input },
    ).pipe(map((r) => r.createOperatorAvailability));
  }

  /** Appuntamenti che resterebbero scoperti togliendo queste disponibilità. */
  previewAvailabilityRemoval(exceptionIds: string[]): Observable<ImpactedAppointment[]> {
    return this.query<{ previewAvailabilityRemovalImpact: ImpactedAppointment[] }>(
      PREVIEW_AVAILABILITY_REMOVAL_IMPACT,
      { exceptionIds },
    ).pipe(map((r) => r.previewAvailabilityRemovalImpact || []));
  }

  /** Appuntamenti che perderebbero copertura eliminando l'intero gruppo. */
  previewGroupRemoval(sourceGroupId: string): Observable<ImpactedAppointment[]> {
    return this.query<{ previewGroupRemovalImpact: ImpactedAppointment[] }>(
      PREVIEW_GROUP_REMOVAL_IMPACT,
      { sourceGroupId },
    ).pipe(map((r) => r.previewGroupRemovalImpact || []));
  }

  /**
   * Elimina un gruppo di qualunque tipo: il backend ripristina i conflitti
   * generati dal gruppo e segnala quelli rimasti scoperti.
   */
  deleteExceptionGroup(sourceGroupId: string): Observable<AvailabilityRemovalResult> {
    return this.mutate<{ deleteExceptionGroup: AvailabilityRemovalResult }>(
      DELETE_EXCEPTION_GROUP,
      { sourceGroupId },
    ).pipe(map((r) => r.deleteExceptionGroup));
  }

  // ============ CAMBIO ORARIO ============

  previewScheduleChange(
    input: CreateScheduleChangeInput,
  ): Observable<ScheduleChangeImpactPreview> {
    return this.query<{ previewScheduleChangeImpact: ScheduleChangeImpactPreview }>(
      PREVIEW_SCHEDULE_CHANGE_IMPACT,
      { input },
    ).pipe(map((r) => r.previewScheduleChangeImpact));
  }

  createScheduleChange(
    input: CreateScheduleChangeInput,
  ): Observable<ScheduleChangeResult> {
    return this.mutate<{ createScheduleChange: ScheduleChangeResult }>(
      CREATE_SCHEDULE_CHANGE,
      { input },
    ).pipe(map((r) => r.createScheduleChange));
  }
}
