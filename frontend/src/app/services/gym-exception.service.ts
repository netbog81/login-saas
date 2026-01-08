import { Injectable, Injector } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BaseGraphQLService } from '../core/services/base-graphql.service';
import {
  GET_GYM_EXCEPTIONS,
  GET_GYM_EXCEPTIONS_BY_DATE,
  GET_GYM_EXCEPTION,
} from '../graphql/operations/gym-exception.queries';
import {
  CREATE_GYM_EXCEPTION,
  UPDATE_GYM_EXCEPTION,
  DELETE_GYM_EXCEPTION,
} from '../graphql/operations/gym-exception.mutations';

/**
 * Tipi di eccezione per la palestra
 */
export enum GymExceptionType {
  CLOSED = 'closed',
  OPERATOR_ABSENT = 'operator_absent',
  MODIFIED_HOURS = 'modified_hours',
}

/**
 * Input per creare una nuova eccezione
 */
export interface CreateGymExceptionInput {
  gymRoomId: string;
  operatorId?: string;
  exceptionDate: string;
  startTime?: string;
  endTime?: string;
  exceptionType: GymExceptionType;
  substituteOperatorId?: string;
  reason?: string;
}

/**
 * Input per aggiornare un'eccezione esistente
 */
export interface UpdateGymExceptionInput {
  operatorId?: string;
  exceptionDate?: string;
  startTime?: string;
  endTime?: string;
  exceptionType?: GymExceptionType;
  substituteOperatorId?: string;
  reason?: string;
}

/**
 * Rappresentazione di un operatore nell'eccezione
 */
export interface GymExceptionOperator {
  id: string;
  name: string;
  surname: string;
  color?: string;
}

/**
 * Rappresentazione della GymRoom associata
 */
export interface GymExceptionGymRoom {
  id: string;
  name: string;
}

/**
 * Rappresentazione completa di un'eccezione palestra
 */
export interface GymException {
  id: string;
  gymRoomId: string;
  operatorId?: string;
  exceptionDate: string;
  startTime?: string;
  endTime?: string;
  exceptionType: GymExceptionType;
  substituteOperatorId?: string;
  reason?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  gymRoom: GymExceptionGymRoom;
  operator?: GymExceptionOperator;
  substituteOperator?: GymExceptionOperator;
}

@Injectable({
  providedIn: 'root',
})
export class GymExceptionService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  /**
   * Ottiene le eccezioni per una palestra in un range di date
   */
  getByDateRange(
    gymRoomId: string,
    startDate: string,
    endDate: string
  ): Observable<GymException[]> {
    return this.query<{ gymExceptions: GymException[] }>(
      GET_GYM_EXCEPTIONS,
      { gymRoomId, startDate, endDate }
    ).pipe(map((result) => result.gymExceptions || []));
  }

  /**
   * Ottiene le eccezioni per una palestra in una data specifica
   */
  getByDate(gymRoomId: string, date: string): Observable<GymException[]> {
    return this.query<{ gymExceptionsByDate: GymException[] }>(
      GET_GYM_EXCEPTIONS_BY_DATE,
      { gymRoomId, date }
    ).pipe(map((result) => result.gymExceptionsByDate || []));
  }

  /**
   * Ottiene una singola eccezione per ID
   */
  getById(id: string): Observable<GymException | null> {
    return this.query<{ gymException: GymException | null }>(
      GET_GYM_EXCEPTION,
      { id }
    ).pipe(map((result) => result.gymException || null));
  }

  /**
   * Crea una nuova eccezione per la palestra
   */
  create(input: CreateGymExceptionInput): Observable<GymException> {
    return this.mutate<{ createGymException: GymException }>(
      CREATE_GYM_EXCEPTION,
      { input },
      [
        {
          query: GET_GYM_EXCEPTIONS,
          variables: {
            gymRoomId: input.gymRoomId,
            startDate: this.getMonthStart(input.exceptionDate),
            endDate: this.getMonthEnd(input.exceptionDate),
          },
        },
      ]
    ).pipe(
      map((result) => {
        if (!result.createGymException) {
          throw new Error('Errore nella creazione dell\'eccezione');
        }
        return result.createGymException;
      })
    );
  }

  /**
   * Aggiorna un'eccezione esistente
   */
  update(id: string, input: UpdateGymExceptionInput): Observable<GymException> {
    return this.mutate<{ updateGymException: GymException }>(
      UPDATE_GYM_EXCEPTION,
      { id, input },
      [{ query: GET_GYM_EXCEPTION, variables: { id } }]
    ).pipe(
      map((result) => {
        if (!result.updateGymException) {
          throw new Error('Errore nell\'aggiornamento dell\'eccezione');
        }
        return result.updateGymException;
      })
    );
  }

  /**
   * Elimina un'eccezione
   */
  delete(id: string, gymRoomId: string, exceptionDate: string): Observable<boolean> {
    return this.mutate<{ deleteGymException: boolean }>(
      DELETE_GYM_EXCEPTION,
      { id },
      [
        {
          query: GET_GYM_EXCEPTIONS,
          variables: {
            gymRoomId,
            startDate: this.getMonthStart(exceptionDate),
            endDate: this.getMonthEnd(exceptionDate),
          },
        },
      ]
    ).pipe(
      map((result) => {
        if (result.deleteGymException === undefined) {
          throw new Error('Errore nell\'eliminazione dell\'eccezione');
        }
        return result.deleteGymException;
      })
    );
  }

  /**
   * Helper: Ottiene il primo giorno del mese per una data
   */
  private getMonthStart(dateStr: string): string {
    const date = new Date(dateStr);
    return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
  }

  /**
   * Helper: Ottiene l'ultimo giorno del mese per una data
   */
  private getMonthEnd(dateStr: string): string {
    const date = new Date(dateStr);
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
  }

  /**
   * Helper: Formatta il tipo di eccezione per la visualizzazione
   */
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
