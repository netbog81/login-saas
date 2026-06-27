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
  GET_ARCHIVED_OPERATORS,
  GET_OPERATOR_DEPENDENCIES,
} from '../graphql/operations/operator.queries';
import {
  GET_PHYSIOTHERAPIST_AVAILABLE_SLOTS,
  GET_PHYSIOTHERAPIST_AVAILABLE_SLOTS_BATCH,
} from '../graphql/operations/availability.queries';
import {
  CREATE_OPERATOR,
  UPDATE_OPERATOR,
  DELETE_OPERATOR,
  RESTORE_OPERATOR,
} from '../graphql/operations/operator.mutations';
import { BaseGraphQLService } from '../core/services/base-graphql.service';

/**
 * Conteggio dipendenze storiche dell'operatore. Una qualunque > 0
 * implica che l'eliminazione viene convertita in archiviazione.
 */
export interface OperatorDependencyCount {
  total: number;
  treatments: number;
  therapeuticPaths: number;
  evaluations: number;
  anamnesis: number;
  appointments: number;
  gymSchedules: number;
  templateAssignments: number;
  waitingList: number;
}

/** Esito dell'eliminazione di un operatore. */
export interface DeleteOperatorResult {
  archived: boolean;
  hardDeleted: boolean;
  dependencies: OperatorDependencyCount;
}

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
   * Elimina o archivia un operatore.
   *
   * Il backend decide automaticamente l'azione:
   *  - se ha dipendenze storiche → archivia (soft-delete preservando lo
   *    storico clinico, AppUser disattivato, template scollegati)
   *  - se non ha dipendenze → hard-delete come prima
   *
   * Il client può distinguere i due casi tramite `archived` / `hardDeleted`
   * per mostrare un messaggio diverso.
   */
  deleteOperator(id: string): Observable<DeleteOperatorResult> {
    return this.mutate<{ deleteOperator: DeleteOperatorResult }>(
      DELETE_OPERATOR,
      { id },
      [{ query: GET_OPERATORS }, { query: GET_ARCHIVED_OPERATORS }],
    ).pipe(map(result => result.deleteOperator));
  }

  /** Ripristina un operatore archiviato (admin only). */
  restoreOperator(id: string): Observable<Operator> {
    return this.mutate<{ restoreOperator: Operator }>(
      RESTORE_OPERATOR,
      { id },
      [{ query: GET_OPERATORS }, { query: GET_ARCHIVED_OPERATORS }],
    ).pipe(map(result => result.restoreOperator));
  }

  /** Lista operatori archiviati per la pagina admin (admin only). */
  getArchivedOperators(): Observable<Operator[]> {
    return this.query<{ archivedOperators: Operator[] }>(
      GET_ARCHIVED_OPERATORS,
    ).pipe(map(result => result.archivedOperators ?? []));
  }

  /**
   * Conteggio dipendenze storiche di un operatore. Pensato per il dialog
   * di conferma archiviazione (mostra all'admin quanti record sono in gioco).
   */
  getOperatorDependencies(id: string): Observable<OperatorDependencyCount> {
    return this.query<{ operatorDependencies: OperatorDependencyCount }>(
      GET_OPERATOR_DEPENDENCIES,
      { id },
    ).pipe(map(result => result.operatorDependencies));
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

  /**
   * Batch: Slot disponibili per più fisioterapisti in più date (~5 query DB).
   */
  getPhysiotherapistAvailableSlotsBatch(
    operatorIds: string[],
    dates: string[],
    durationMinutes: number,
    customInstrumentSlots?: { instrumentCategoryId: string; startOffsetMinutes: number; endOffsetMinutes: number }[],
    instrumentOrderMatters?: boolean,
  ): Observable<{ operatorId: string; date: string; startTime: string; endTime: string; available: boolean; suggestedInstruments?: any[] }[]> {
    return this.query<{ physiotherapistAvailableSlotsBatch: any[] }>(
      GET_PHYSIOTHERAPIST_AVAILABLE_SLOTS_BATCH,
      {
        operatorIds,
        dates,
        durationMinutes,
        customInstrumentSlots: customInstrumentSlots && customInstrumentSlots.length > 0 ? customInstrumentSlots : null,
        instrumentOrderMatters: instrumentOrderMatters ?? null,
      },
      'no-cache'
    ).pipe(map((result) => result.physiotherapistAvailableSlotsBatch || []));
  }
}
