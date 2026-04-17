import { Injectable, Injector } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  Operator,
  OperatorMacroCategory,
  CreateOperatorInput,
  UpdateOperatorInput,
  DailyAvailability,
  PhysiotherapistSlotOutput,
  CheckPhysiotherapistAvailabilityInput,
} from '../graphql/generated/types';
import {
  GET_OPERATORS,
  GET_OPERATOR,
  GET_OPERATOR_AVAILABILITY,
  GET_OPERATORS_AVAILABILITY,
  CHECK_DUPLICATE_OPERATOR,
  MY_OPERATOR,
} from '../graphql/operations/operator.queries';
import {
  GET_PHYSIOTHERAPIST_AVAILABLE_SLOTS,
} from '../graphql/operations/availability.queries';
import {
  CREATE_OPERATOR,
  UPDATE_OPERATOR,
  DELETE_OPERATOR,
} from '../graphql/operations/operator.mutations';
import { BaseGraphQLService } from '../core/services/base-graphql.service';

@Injectable({
  providedIn: 'root',
})
export class OperatorService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  /**
   * Ottiene tutti gli operatori con filtri opzionali
   */
  getOperators(
    macroCategory?: OperatorMacroCategory,
    categoryId?: string,
    onlyActive?: boolean
  ): Observable<Operator[]> {
    return this.query<{ operators: Operator[] }>(
      GET_OPERATORS,
      { macroCategory, categoryId, onlyActive }
    ).pipe(map((result) => result.operators || []));
  }

  /**
   * Ottiene un singolo operatore per ID
   */
  getOperator(id: string): Observable<Operator | null> {
    return this.query<{ operator: Operator | null }>(
      GET_OPERATOR,
      { id }
    ).pipe(map((result) => result.operator || null));
  }

  /**
   * Crea un nuovo operatore
   */
  createOperator(input: CreateOperatorInput): Observable<Operator> {
    return this.mutate<{ createOperator: Operator }>(
      CREATE_OPERATOR,
      { input },
      [{ query: GET_OPERATORS }]
    ).pipe(map((result) => result.createOperator));
  }

  /**
   * Aggiorna un operatore esistente
   */
  updateOperator(id: string, input: UpdateOperatorInput): Observable<Operator> {
    return this.mutate<{ updateOperator: Operator }>(
      UPDATE_OPERATOR,
      { id, input },
      [{ query: GET_OPERATORS }, { query: GET_OPERATOR, variables: { id } }]
    ).pipe(map((result) => result.updateOperator));
  }

  /**
   * Elimina un operatore
   */
  deleteOperator(id: string): Observable<boolean> {
    return this.mutate<{ deleteOperator: boolean }>(
      DELETE_OPERATOR,
      { id },
      [{ query: GET_OPERATORS }]
    ).pipe(map((result) => result.deleteOperator));
  }

  /**
   * Ottiene l'operatore associato all'utente corrente (mapping Keycloak → AppUser → Operator)
   */
  getMyOperator(): Observable<Operator | null> {
    return this.query<{ myOperator: Operator | null }>(
      MY_OPERATOR
    ).pipe(map((result) => result.myOperator || null));
  }

  /**
   * Ottiene la disponibilità di un operatore per un periodo
   */
  getOperatorAvailability(
    operatorId: string,
    startDate: string,
    endDate: string
  ): Observable<DailyAvailability[]> {
    return this.query<{ operatorAvailability: DailyAvailability[] }>(
      GET_OPERATOR_AVAILABILITY,
      { operatorId, startDate, endDate }
    ).pipe(
      map((result) => {
        // ApolloZoneService.query emette `data` anche quando `result.error` è valorizzato
        // (vedi commento in apollo-zone.service.ts:74). In quel caso `result` è null/undefined
        // e accedere a .operatorAvailability provocherebbe TypeError. Propaghiamo invece
        // un errore esplicito così il chiamante può gestirlo nel suo catch.
        if (result == null) {
          throw new Error('operatorAvailability query failed');
        }
        return result.operatorAvailability ?? [];
      })
    );
  }

  /**
   * Bulk: Ottiene la disponibilità per più operatori in un range di date.
   */
  getOperatorsAvailability(
    operatorIds: string[],
    startDate: string,
    endDate: string,
  ): Observable<{ operatorId: string; availability: DailyAvailability[] }[]> {
    if (operatorIds.length === 0) return new Observable(s => { s.next([]); s.complete(); });
    return this.query<{ operatorsAvailability: { operatorId: string; availability: DailyAvailability[] }[] }>(
      GET_OPERATORS_AVAILABILITY,
      { operatorIds, startDate, endDate },
      'no-cache'
    ).pipe(
      map((result) => result?.operatorsAvailability ?? [])
    );
  }

  /**
   * Controlla se esistono operatori con nome simile (per warning duplicati)
   */
  checkDuplicateOperator(name: string, surname?: string): Observable<Operator[]> {
    return this.query<{ checkDuplicateOperator: Operator[] }>(
      CHECK_DUPLICATE_OPERATOR,
      { name, surname }
    ).pipe(map((result) => result.checkDuplicateOperator || []));
  }

  /**
   * Ottiene gli slot disponibili per un fisioterapista con supporto strumenti
   */
  getPhysiotherapistAvailableSlots(
    input: CheckPhysiotherapistAvailabilityInput
  ): Observable<PhysiotherapistSlotOutput[]> {
    return this.query<{ physiotherapistAvailableSlots: PhysiotherapistSlotOutput[] }>(
      GET_PHYSIOTHERAPIST_AVAILABLE_SLOTS,
      { input }
    ).pipe(map((result) => result.physiotherapistAvailableSlots || []));
  }
}
