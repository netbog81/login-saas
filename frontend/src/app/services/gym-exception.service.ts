import { Injectable, Injector } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BaseGraphQLService } from '../core/services/base-graphql.service';
import {
  GET_GYM_EXCEPTIONS,
  GET_GYM_EXCEPTIONS_BY_DATE,
  GET_GYM_EXCEPTION,
  GET_OPERATOR_PATTERNS_ON_DATE,
  GET_AVAILABLE_OPERATORS_FOR_SLOT,
} from '../graphql/operations/gym-exception.queries';
import {
  CREATE_GYM_EXCEPTION,
  UPDATE_GYM_EXCEPTION,
  DELETE_GYM_EXCEPTION,
} from '../graphql/operations/gym-exception.mutations';

/**
 * Tipi di eccezione per la palestra — allineati allo schema GraphQL backend
 */
export enum GymExceptionType {
  CLOSED = 'CLOSED',
  OPERATOR_ABSENT = 'OPERATOR_ABSENT',
  MODIFIED_HOURS = 'MODIFIED_HOURS',
}

/**
 * Singolo slot di sostituzione all'interno di un'eccezione OPERATOR_ABSENT.
 *
 * - substituteOperatorId valorizzato: lo slot ha un sostituto attivo.
 * - substituteOperatorId = undefined + isClosed = false: slot scoperto/dimenticato.
 * - substituteOperatorId = undefined + isClosed = true: l'utente ha esplicitamente
 *   marcato lo slot come "palestra chiusa".
 */
export interface GymExceptionSubstituteInput {
  gymRoomId: string;
  startTime: string;
  endTime: string;
  substituteOperatorId?: string;
  isClosed?: boolean;
}

/**
 * Input per creare una nuova eccezione
 */
export interface CreateGymExceptionInput {
  gymRoomId?: string;
  operatorId?: string;
  exceptionDate: string;
  startTime?: string;
  endTime?: string;
  exceptionType: GymExceptionType;
  substituteOperatorId?: string;
  substitutes?: GymExceptionSubstituteInput[];
  absenceTypeId?: string;
  reason?: string;
}

export interface UpdateGymExceptionInput {
  gymRoomId?: string;
  operatorId?: string;
  exceptionDate?: string;
  startTime?: string;
  endTime?: string;
  exceptionType?: GymExceptionType;
  substituteOperatorId?: string;
  substitutes?: GymExceptionSubstituteInput[];
  absenceTypeId?: string;
  reason?: string;
}

export interface GymExceptionOperator {
  id: string;
  name: string;
  surname: string;
  color?: string;
}

export interface GymExceptionGymRoom {
  id: string;
  name: string;
}

/**
 * Snapshot del tipo di assenza salvato al momento della creazione.
 */
export interface AbsenceTypeSnapshot {
  id: string;
  name: string;
  description?: string;
}

/**
 * Riga della collezione figlia "substitutes" esposta dal backend.
 */
export interface GymExceptionSubstitute {
  id: string;
  gymRoomId: string;
  startTime: string;
  endTime: string;
  substituteOperatorId?: string;
  isClosed: boolean;
  gymRoom: GymExceptionGymRoom;
  substituteOperator?: GymExceptionOperator;
}

export interface GymException {
  id: string;
  gymRoomId?: string;
  operatorId?: string;
  exceptionDate: string;
  startTime?: string;
  endTime?: string;
  exceptionType: GymExceptionType;
  substituteOperatorId?: string;
  absenceTypeId?: string;
  absenceTypeSnapshot?: AbsenceTypeSnapshot;
  reason?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  gymRoom?: GymExceptionGymRoom;
  operator?: GymExceptionOperator;
  substituteOperator?: GymExceptionOperator;
  substitutes?: GymExceptionSubstitute[];
}

/**
 * Slot di pattern di un operatore in una data specifica (per popolare
 * la griglia nel modal di creazione eccezione).
 */
export interface OperatorSlotOnDate {
  gymRoom: GymExceptionGymRoom;
  startTime: string;
  endTime: string;
}

/**
 * Operatore "libero" proposto come candidato sostituto per uno slot.
 */
export interface AvailableOperator {
  id: string;
  name: string;
  surname: string;
  color?: string;
}

@Injectable({
  providedIn: 'root',
})
export class GymExceptionService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  getByDateRange(
    gymRoomId: string,
    startDate: string,
    endDate: string,
  ): Observable<GymException[]> {
    return this.query<{ gymExceptions: GymException[] }>(GET_GYM_EXCEPTIONS, {
      gymRoomId,
      startDate,
      endDate,
    }).pipe(map((result) => result.gymExceptions || []));
  }

  getByDate(gymRoomId: string, date: string): Observable<GymException[]> {
    return this.query<{ gymExceptionsByDate: GymException[] }>(
      GET_GYM_EXCEPTIONS_BY_DATE,
      { gymRoomId, date },
    ).pipe(map((result) => result.gymExceptionsByDate || []));
  }

  getById(id: string): Observable<GymException | null> {
    return this.query<{ gymException: GymException | null }>(GET_GYM_EXCEPTION, {
      id,
    }).pipe(map((result) => result.gymException || null));
  }

  /**
   * Ritorna tutti gli slot in cui l'operatore era schedulato nella data
   * indicata, attraverso tutte le palestre (derivati da GymTemplatePattern).
   */
  getOperatorPatternsOnDate(
    operatorId: string,
    date: string,
  ): Observable<OperatorSlotOnDate[]> {
    return this.query<{ operatorPatternsOnDate: OperatorSlotOnDate[] }>(
      GET_OPERATOR_PATTERNS_ON_DATE,
      { operatorId, date },
    ).pipe(map((result) => result.operatorPatternsOnDate || []));
  }

  /**
   * Ritorna gli operatori gym_instructor liberi in una fascia oraria di una
   * palestra (senza pattern attivo, senza eccezione di assenza).
   */
  getAvailableOperatorsForSlot(
    gymRoomId: string,
    date: string,
    startTime: string,
    endTime: string,
    excludeOperatorId: string,
  ): Observable<AvailableOperator[]> {
    return this.query<{ availableOperatorsForSlot: AvailableOperator[] }>(
      GET_AVAILABLE_OPERATORS_FOR_SLOT,
      { gymRoomId, date, startTime, endTime, excludeOperatorId },
    ).pipe(map((result) => result.availableOperatorsForSlot || []));
  }

  create(input: CreateGymExceptionInput): Observable<GymException> {
    return this.mutate<{ createGymException: GymException }>(
      CREATE_GYM_EXCEPTION,
      { input },
      input.gymRoomId
        ? [
            {
              query: GET_GYM_EXCEPTIONS,
              variables: {
                gymRoomId: input.gymRoomId,
                startDate: this.getMonthStart(input.exceptionDate),
                endDate: this.getMonthEnd(input.exceptionDate),
              },
            },
          ]
        : undefined,
    ).pipe(
      map((result) => {
        if (!result.createGymException) {
          throw new Error("Errore nella creazione dell'eccezione");
        }
        return result.createGymException;
      }),
    );
  }

  update(
    id: string,
    input: UpdateGymExceptionInput,
  ): Observable<GymException> {
    return this.mutate<{ updateGymException: GymException }>(
      UPDATE_GYM_EXCEPTION,
      { id, input },
      [{ query: GET_GYM_EXCEPTION, variables: { id } }],
    ).pipe(
      map((result) => {
        if (!result.updateGymException) {
          throw new Error("Errore nell'aggiornamento dell'eccezione");
        }
        return result.updateGymException;
      }),
    );
  }

  delete(
    id: string,
    gymRoomId: string | undefined,
    exceptionDate: string,
  ): Observable<boolean> {
    return this.mutate<{ deleteGymException: boolean }>(
      DELETE_GYM_EXCEPTION,
      { id },
      gymRoomId
        ? [
            {
              query: GET_GYM_EXCEPTIONS,
              variables: {
                gymRoomId,
                startDate: this.getMonthStart(exceptionDate),
                endDate: this.getMonthEnd(exceptionDate),
              },
            },
          ]
        : undefined,
    ).pipe(
      map((result) => {
        if (result.deleteGymException === undefined) {
          throw new Error("Errore nell'eliminazione dell'eccezione");
        }
        return result.deleteGymException;
      }),
    );
  }

  private getMonthStart(dateStr: string): string {
    const date = new Date(dateStr);
    return new Date(date.getFullYear(), date.getMonth(), 1)
      .toISOString()
      .split('T')[0];
  }

  private getMonthEnd(dateStr: string): string {
    const date = new Date(dateStr);
    return new Date(date.getFullYear(), date.getMonth() + 1, 0)
      .toISOString()
      .split('T')[0];
  }

  formatExceptionType(type: GymExceptionType): string {
    switch (type) {
      case GymExceptionType.CLOSED:
        return 'Chiusura';
      case GymExceptionType.OPERATOR_ABSENT:
        return 'Operatore assente';
      case GymExceptionType.MODIFIED_HOURS:
        return 'Orari modificati';
      default:
        return type;
    }
  }
}
