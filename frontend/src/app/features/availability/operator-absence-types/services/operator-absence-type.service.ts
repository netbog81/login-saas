import { Injectable, Injector } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BaseGraphQLService } from '../../../../core/services/base-graphql.service';
import {
  GET_OPERATOR_ABSENCE_TYPES,
  GET_OPERATOR_ABSENCE_TYPE,
} from '../../../../graphql/operations/operator-absence-type.queries';
import {
  CREATE_OPERATOR_ABSENCE_TYPE,
  UPDATE_OPERATOR_ABSENCE_TYPE,
  DELETE_OPERATOR_ABSENCE_TYPE,
} from '../../../../graphql/operations/operator-absence-type.mutations';
import {
  OperatorAbsenceType,
  CreateOperatorAbsenceTypeInput,
  UpdateOperatorAbsenceTypeInput,
} from '../models/operator-absence-type.model';

@Injectable({ providedIn: 'root' })
export class OperatorAbsenceTypeService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  list(onlyActive?: boolean): Observable<OperatorAbsenceType[]> {
    return this.query<{ operatorAbsenceTypes: OperatorAbsenceType[] }>(
      GET_OPERATOR_ABSENCE_TYPES,
      { onlyActive },
    ).pipe(map((result) => result.operatorAbsenceTypes || []));
  }

  getById(id: string): Observable<OperatorAbsenceType | null> {
    return this.query<{ operatorAbsenceType: OperatorAbsenceType | null }>(
      GET_OPERATOR_ABSENCE_TYPE,
      { id },
    ).pipe(map((result) => result.operatorAbsenceType || null));
  }

  create(input: CreateOperatorAbsenceTypeInput): Observable<OperatorAbsenceType> {
    return this.mutate<{ createOperatorAbsenceType: OperatorAbsenceType }>(
      CREATE_OPERATOR_ABSENCE_TYPE,
      { input },
      [{ query: GET_OPERATOR_ABSENCE_TYPES, variables: { onlyActive: undefined } }],
    ).pipe(map((result) => result.createOperatorAbsenceType));
  }

  update(
    id: string,
    input: UpdateOperatorAbsenceTypeInput,
  ): Observable<OperatorAbsenceType> {
    return this.mutate<{ updateOperatorAbsenceType: OperatorAbsenceType }>(
      UPDATE_OPERATOR_ABSENCE_TYPE,
      { id, input },
      [{ query: GET_OPERATOR_ABSENCE_TYPES, variables: { onlyActive: undefined } }],
    ).pipe(map((result) => result.updateOperatorAbsenceType));
  }

  delete(id: string): Observable<boolean> {
    return this.mutate<{ deleteOperatorAbsenceType: boolean }>(
      DELETE_OPERATOR_ABSENCE_TYPE,
      { id },
      [{ query: GET_OPERATOR_ABSENCE_TYPES, variables: { onlyActive: undefined } }],
    ).pipe(map((result) => result.deleteOperatorAbsenceType));
  }
}
