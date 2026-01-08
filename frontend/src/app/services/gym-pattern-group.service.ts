import { Injectable, Injector } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BaseGraphQLService } from '../core/services/base-graphql.service';
import {
  GET_GYM_PATTERN_GROUPS,
  GET_GYM_PATTERN_GROUP,
  GET_CURRENT_GYM_PATTERN_GROUP,
} from '../graphql/operations/gym-pattern-group.queries';
import {
  CREATE_GYM_PATTERN_GROUP,
  UPDATE_GYM_PATTERN_GROUP,
  DELETE_GYM_PATTERN_GROUP,
  ACTIVATE_GYM_PATTERN_GROUP,
  DEACTIVATE_GYM_PATTERN_GROUP,
  DUPLICATE_GYM_PATTERN_GROUP,
} from '../graphql/operations/gym-pattern-group.mutations';

/**
 * Input per creare un singolo pattern nel template
 */
export interface CreateGymTemplatePatternInput {
  operatorId: string;
  dayInPattern: number;
  startTime: string;
  endTime: string;
}

/**
 * Input per creare un nuovo GymPatternGroup
 */
export interface CreateGymPatternGroupInput {
  gymRoomId: string;
  name: string;
  description?: string;
  patternDuration?: number;
  patternStartDate: string;
  validFrom: string;
  validUntil?: string;
  patterns?: CreateGymTemplatePatternInput[];
}

/**
 * Input per aggiornare un GymPatternGroup
 */
export interface UpdateGymPatternGroupInput {
  name?: string;
  description?: string;
  patternStartDate?: string;
  validFrom?: string;
  validUntil?: string;
  isActive?: boolean;
  patterns?: CreateGymTemplatePatternInput[];
}

/**
 * Rappresentazione di un operatore nel pattern
 */
export interface GymPatternOperator {
  id: string;
  name: string;
  surname: string;
  color?: string;
}

/**
 * Rappresentazione di un singolo pattern (fascia oraria)
 */
export interface GymTemplatePattern {
  id: string;
  operatorId: string;
  dayInPattern: number;
  startTime: string;
  endTime: string;
  createdAt: string;
  updatedAt: string;
  operator: GymPatternOperator;
}

/**
 * Rappresentazione della GymRoom associata
 */
export interface GymPatternGymRoom {
  id: string;
  name: string;
  maxCapacity: number;
  slotDuration: number;
  color?: string;
  defaultStartTime?: string;
  defaultEndTime?: string;
}

/**
 * Rappresentazione completa di un GymPatternGroup
 */
export interface GymPatternGroup {
  id: string;
  gymRoomId: string;
  name: string;
  description?: string;
  patternDuration: number;
  patternStartDate: string;
  isActive: boolean;
  isCurrent: boolean;
  version: number;
  validFrom: string;
  validUntil?: string;
  createdAt: string;
  updatedAt: string;
  gymRoom: GymPatternGymRoom;
  patterns: GymTemplatePattern[];
}

@Injectable({
  providedIn: 'root',
})
export class GymPatternGroupService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  /**
   * Ottiene tutti i GymPatternGroup per una palestra (opzionale)
   */
  getAll(gymRoomId?: string): Observable<GymPatternGroup[]> {
    return this.query<{ gymPatternGroups: GymPatternGroup[] }>(
      GET_GYM_PATTERN_GROUPS,
      { gymRoomId }
    ).pipe(map((result) => result.gymPatternGroups || []));
  }

  /**
   * Ottiene tutti i GymPatternGroup per una specifica palestra
   */
  getByGymRoom(gymRoomId: string): Observable<GymPatternGroup[]> {
    return this.getAll(gymRoomId);
  }

  /**
   * Ottiene un singolo GymPatternGroup per ID
   */
  getById(id: string): Observable<GymPatternGroup | null> {
    return this.query<{ gymPatternGroup: GymPatternGroup | null }>(
      GET_GYM_PATTERN_GROUP,
      { id }
    ).pipe(map((result) => result.gymPatternGroup || null));
  }

  /**
   * Ottiene il GymPatternGroup corrente (attivo) per una palestra
   */
  getCurrent(gymRoomId: string): Observable<GymPatternGroup | null> {
    return this.query<{ currentGymPatternGroup: GymPatternGroup | null }>(
      GET_CURRENT_GYM_PATTERN_GROUP,
      { gymRoomId }
    ).pipe(map((result) => result.currentGymPatternGroup || null));
  }

  /**
   * Crea un nuovo GymPatternGroup
   */
  create(input: CreateGymPatternGroupInput): Observable<GymPatternGroup> {
    return this.mutate<{ createGymPatternGroup: GymPatternGroup }>(
      CREATE_GYM_PATTERN_GROUP,
      { input },
      [
        { query: GET_GYM_PATTERN_GROUPS, variables: { gymRoomId: input.gymRoomId } },
        { query: GET_GYM_PATTERN_GROUPS },
      ]
    ).pipe(
      map((result) => {
        if (!result.createGymPatternGroup) {
          throw new Error('Errore nella creazione del template palestra');
        }
        return result.createGymPatternGroup;
      })
    );
  }

  /**
   * Aggiorna un GymPatternGroup esistente
   */
  update(id: string, input: UpdateGymPatternGroupInput): Observable<GymPatternGroup> {
    return this.mutate<{ updateGymPatternGroup: GymPatternGroup }>(
      UPDATE_GYM_PATTERN_GROUP,
      { id, input },
      [
        { query: GET_GYM_PATTERN_GROUPS },
        { query: GET_GYM_PATTERN_GROUP, variables: { id } },
      ]
    ).pipe(
      map((result) => {
        if (!result.updateGymPatternGroup) {
          throw new Error('Errore nell\'aggiornamento del template palestra');
        }
        return result.updateGymPatternGroup;
      })
    );
  }

  /**
   * Elimina un GymPatternGroup
   */
  delete(id: string): Observable<boolean> {
    return this.mutate<{ deleteGymPatternGroup: boolean }>(
      DELETE_GYM_PATTERN_GROUP,
      { id },
      [{ query: GET_GYM_PATTERN_GROUPS }]
    ).pipe(
      map((result) => {
        if (result.deleteGymPatternGroup === undefined) {
          throw new Error('Errore nell\'eliminazione del template palestra');
        }
        return result.deleteGymPatternGroup;
      })
    );
  }

  /**
   * Attiva un GymPatternGroup (imposta come corrente per la palestra)
   */
  activate(id: string): Observable<GymPatternGroup> {
    return this.mutate<{ activateGymPatternGroup: GymPatternGroup }>(
      ACTIVATE_GYM_PATTERN_GROUP,
      { id },
      [{ query: GET_GYM_PATTERN_GROUPS }]
    ).pipe(
      map((result) => {
        if (!result.activateGymPatternGroup) {
          throw new Error('Errore nell\'attivazione del template palestra');
        }
        return result.activateGymPatternGroup;
      })
    );
  }

  /**
   * Disattiva un GymPatternGroup
   */
  deactivate(id: string): Observable<GymPatternGroup> {
    return this.mutate<{ deactivateGymPatternGroup: GymPatternGroup }>(
      DEACTIVATE_GYM_PATTERN_GROUP,
      { id },
      [{ query: GET_GYM_PATTERN_GROUPS }]
    ).pipe(
      map((result) => {
        if (!result.deactivateGymPatternGroup) {
          throw new Error('Errore nella disattivazione del template palestra');
        }
        return result.deactivateGymPatternGroup;
      })
    );
  }

  /**
   * Duplica un GymPatternGroup con un nuovo nome
   */
  duplicate(id: string, name: string): Observable<GymPatternGroup> {
    return this.mutate<{ duplicateGymPatternGroup: GymPatternGroup }>(
      DUPLICATE_GYM_PATTERN_GROUP,
      { id, newName: name },
      [{ query: GET_GYM_PATTERN_GROUPS }]
    ).pipe(
      map((result) => {
        if (!result.duplicateGymPatternGroup) {
          throw new Error('Errore nella duplicazione del template palestra');
        }
        return result.duplicateGymPatternGroup;
      })
    );
  }
}
