import { Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Observable, map } from 'rxjs';
import {
  Operator,
  OperatorMacroCategory,
  CreateOperatorInput,
  UpdateOperatorInput,
  DailyAvailability,
} from '../graphql/types';
import {
  GET_OPERATORS,
  GET_OPERATOR,
  GET_OPERATOR_AVAILABILITY,
} from '../graphql/operations/operator.queries';
import {
  CREATE_OPERATOR,
  UPDATE_OPERATOR,
  DELETE_OPERATOR,
} from '../graphql/operations/operator.mutations';

@Injectable({
  providedIn: 'root',
})
export class OperatorService {
  constructor(private apollo: Apollo) {}

  /**
   * Ottiene tutti gli operatori con filtri opzionali
   */
  getOperators(
    macroCategory?: OperatorMacroCategory,
    categoryId?: string,
    onlyActive?: boolean
  ): Observable<Operator[]> {
    return this.apollo
      .watchQuery<{ operators: any[] }>({
        query: GET_OPERATORS,
        variables: { macroCategory, categoryId, onlyActive },
        fetchPolicy: 'network-only',
      })
      .valueChanges.pipe(map((result) => (result.data?.operators || []) as Operator[]));
  }

  /**
   * Ottiene un singolo operatore per ID
   */
  getOperator(id: string): Observable<Operator | null> {
    return this.apollo
      .watchQuery<{ operator: any | null }>({
        query: GET_OPERATOR,
        variables: { id },
        fetchPolicy: 'network-only',
      })
      .valueChanges.pipe(map((result) => (result.data?.operator || null) as Operator | null));
  }

  /**
   * Crea un nuovo operatore
   */
  createOperator(input: CreateOperatorInput): Observable<Operator> {
    const variables = {
      name: input.name,
      surname: input.surname,
      email: input.email,
      phone: input.phone,
      color: input.color,
      macroCategory: input.macroCategory,
      categoryId: input.categoryId,
      preferredDurations: input.preferredDurations,
      maxConcurrentAppointments:
        input.maxConcurrentAppointments !== undefined
          ? input.maxConcurrentAppointments
          : 1,
      legacyUserId: input.legacyUserId,
    };

    return this.apollo
      .mutate<{ createOperator: Operator }>({
        mutation: CREATE_OPERATOR,
        variables,
        refetchQueries: [{ query: GET_OPERATORS }],
        awaitRefetchQueries: true,
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error('Failed to create operator');
          }
          return result.data.createOperator;
        })
      );
  }

  /**
   * Aggiorna un operatore esistente
   */
  updateOperator(
    id: string,
    input: UpdateOperatorInput
  ): Observable<Operator> {
    return this.apollo
      .mutate<{ updateOperator: Operator }>({
        mutation: UPDATE_OPERATOR,
        variables: { id, ...input },
        refetchQueries: [
          { query: GET_OPERATORS },
          { query: GET_OPERATOR, variables: { id } },
        ],
        awaitRefetchQueries: true,
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error('Failed to update operator');
          }
          return result.data.updateOperator;
        })
      );
  }

  /**
   * Elimina un operatore
   */
  deleteOperator(id: string): Observable<boolean> {
    return this.apollo
      .mutate<{ deleteOperator: boolean }>({
        mutation: DELETE_OPERATOR,
        variables: { id },
        refetchQueries: [{ query: GET_OPERATORS }],
        awaitRefetchQueries: true,
        update: (cache) => {
          // Remove the deleted operator from cache
          const data = cache.readQuery<{ operators: Operator[] }>({
            query: GET_OPERATORS,
          });
          if (data) {
            cache.writeQuery({
              query: GET_OPERATORS,
              data: {
                operators: data.operators.filter((op) => op.id !== id),
              },
            });
          }
        },
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error('Failed to delete operator');
          }
          return result.data.deleteOperator;
        })
      );
  }

  /**
   * Ottiene la disponibilità di un operatore per un periodo
   */
  getOperatorAvailability(
    operatorId: string,
    startDate: string,
    endDate: string
  ): Observable<DailyAvailability[]> {
    return this.apollo
      .watchQuery<{ operatorAvailability: any[] }>({
        query: GET_OPERATOR_AVAILABILITY,
        variables: { operatorId, startDate, endDate },
        fetchPolicy: 'network-only', // Always fetch fresh availability data
      })
      .valueChanges.pipe(
        map((result) => (result.data?.operatorAvailability || []) as DailyAvailability[])
      );
  }
}
