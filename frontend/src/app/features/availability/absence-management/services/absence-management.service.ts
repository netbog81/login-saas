import { Injectable, Injector } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BaseGraphQLService } from '../../../../core/services/base-graphql.service';
import {
  GET_OPERATOR_ABSENCES,
  PREVIEW_OPERATOR_ABSENCE_IMPACT,
  CREATE_OPERATOR_ABSENCES,
  DELETE_ABSENCE,
  DELETE_ABSENCE_GROUP,
} from '../graphql/absence.operations';
import {
  OperatorAbsence,
  AbsenceImpactPreview,
  CreateOperatorAbsencesInput,
  OperatorAbsencesResult,
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
}
