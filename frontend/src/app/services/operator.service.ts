import { Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Observable, map } from 'rxjs';
import { Operator } from '../graphql/ui-types';
import {
  MutationCreateOperatorArgs as CreateOperatorInput,
  MutationUpdateOperatorArgs as UpdateOperatorInput,
  DailyAvailability
} from '../graphql/generated/types';
import {
  GET_OPERATORS,
  GET_OPERATOR,
  GET_OPERATOR_AVAILABILITY
} from '../graphql/operations/operator.queries';
import {
  CREATE_OPERATOR,
  UPDATE_OPERATOR,
  DELETE_OPERATOR
} from '../graphql/operations/operator.mutations';

@Injectable({
  providedIn: 'root'
})
export class OperatorService {
  constructor(private apollo: Apollo) {}

  getOperators(): Observable<Operator[]> {
    return this.apollo
      .watchQuery<{ operators: any[] }>({
        query: GET_OPERATORS,
        fetchPolicy: 'network-only'
      })
      .valueChanges.pipe(
        map(result => {
          const operators = result.data?.operators || [];
          // Map operatorType to type for frontend consistency
          return operators.map(op => ({
            ...op,
            type: op.operatorType
          })) as Operator[];
        })
      );
  }

  getOperator(id: string): Observable<Operator | null> {
    return this.apollo
      .watchQuery<{ operator: any | null }>({
        query: GET_OPERATOR,
        variables: { id }
      })
      .valueChanges.pipe(
        map(result => {
          const operator = result.data?.operator;
          if (!operator) return null;
          // Map operatorType to type for frontend consistency
          return {
            ...operator,
            type: operator.operatorType
          } as Operator;
        })
      );
  }

  createOperator(input: CreateOperatorInput): Observable<Operator> {
    // Map type to operatorType for backend
    const variables = {
      name: input.name,
      email: input.email,
      phone: (input as any).phone,
      operatorType: (input as any).operatorType || (input as any).type,
      maxConcurrentAppointments: (input as any).maxConcurrentAppointments
    };

    console.log('OperatorService.createOperator - sending variables:', variables);

    return this.apollo
      .mutate<{ createOperator: any }>({
        mutation: CREATE_OPERATOR,
        variables,
        refetchQueries: [{ query: GET_OPERATORS }]
      })
      .pipe(
        map(result => {
          console.log('OperatorService.createOperator - received result:', result);
          if (!result.data) {
            throw new Error('Failed to create operator');
          }
          // Map operatorType back to type for frontend consistency
          const operator = result.data.createOperator;
          return {
            ...operator,
            type: operator.operatorType
          } as Operator;
        })
      );
  }

  updateOperator(id: string, input: Omit<UpdateOperatorInput, 'id'>): Observable<Operator> {
    return this.apollo
      .mutate<{ updateOperator: any }>({
        mutation: UPDATE_OPERATOR,
        variables: { id, ...input },
        refetchQueries: [
          { query: GET_OPERATORS },
          { query: GET_OPERATOR, variables: { id } }
        ]
      })
      .pipe(
        map(result => {
          if (!result.data) {
            throw new Error('Failed to update operator');
          }
          // Map operatorType back to type for frontend consistency
          const operator = result.data.updateOperator;
          return {
            ...operator,
            type: operator.operatorType
          } as Operator;
        })
      );
  }

  deleteOperator(id: string): Observable<boolean> {
    return this.apollo
      .mutate<{ deleteOperator: boolean }>({
        mutation: DELETE_OPERATOR,
        variables: { id },
        refetchQueries: [{ query: GET_OPERATORS }],
        update: (cache) => {
          // Remove the deleted operator from cache
          const data = cache.readQuery<{ operators: Operator[] }>({
            query: GET_OPERATORS
          });
          if (data) {
            cache.writeQuery({
              query: GET_OPERATORS,
              data: {
                operators: data.operators.filter(op => op.id !== id)
              }
            });
          }
        }
      })
      .pipe(
        map(result => {
          if (!result.data) {
            throw new Error('Failed to delete operator');
          }
          return result.data.deleteOperator;
        })
      );
  }

  getOperatorAvailability(
    operatorId: string,
    startDate: string,
    endDate: string
  ): Observable<DailyAvailability[]> {
    return this.apollo
      .watchQuery<{ operatorAvailability: DailyAvailability[] }>({
        query: GET_OPERATOR_AVAILABILITY,
        variables: { operatorId, startDate, endDate },
        fetchPolicy: 'network-only' // Always fetch fresh availability data
      })
      .valueChanges.pipe(
        map(result => (result.data?.operatorAvailability || []) as DailyAvailability[])
      );
  }
}