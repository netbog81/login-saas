import { Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Observable, map } from 'rxjs';
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
export class GymPatternGroupService {
  constructor(private apollo: Apollo) {}

  /**
   * Ottiene tutti i GymPatternGroup per una palestra (opzionale)
   */
  getAll(gymRoomId?: string): Observable<GymPatternGroup[]> {
    return this.apollo
      .query<{ gymPatternGroups: GymPatternGroup[] }>({
        query: GET_GYM_PATTERN_GROUPS,
        variables: { gymRoomId },
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => result.data?.gymPatternGroups || []));
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
    return this.apollo
      .query<{ gymPatternGroup: GymPatternGroup | null }>({
        query: GET_GYM_PATTERN_GROUP,
        variables: { id },
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => result.data?.gymPatternGroup || null));
  }

  /**
   * Ottiene il GymPatternGroup corrente (attivo) per una palestra
   */
  getCurrent(gymRoomId: string): Observable<GymPatternGroup | null> {
    return this.apollo
      .query<{ currentGymPatternGroup: GymPatternGroup | null }>({
        query: GET_CURRENT_GYM_PATTERN_GROUP,
        variables: { gymRoomId },
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => result.data?.currentGymPatternGroup || null));
  }

  /**
   * Crea un nuovo GymPatternGroup
   */
  create(input: CreateGymPatternGroupInput): Observable<GymPatternGroup> {
    return this.apollo
      .mutate<{ createGymPatternGroup: GymPatternGroup }>({
        mutation: CREATE_GYM_PATTERN_GROUP,
        variables: { input },
        refetchQueries: [
          { query: GET_GYM_PATTERN_GROUPS, variables: { gymRoomId: input.gymRoomId } },
          { query: GET_GYM_PATTERN_GROUPS },
        ],
        awaitRefetchQueries: true,
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error('Errore nella creazione del template palestra');
          }
          return result.data.createGymPatternGroup;
        })
      );
  }

  /**
   * Aggiorna un GymPatternGroup esistente
   */
  update(id: string, input: UpdateGymPatternGroupInput): Observable<GymPatternGroup> {
    return this.apollo
      .mutate<{ updateGymPatternGroup: GymPatternGroup }>({
        mutation: UPDATE_GYM_PATTERN_GROUP,
        variables: { id, input },
        refetchQueries: [
          { query: GET_GYM_PATTERN_GROUPS },
          { query: GET_GYM_PATTERN_GROUP, variables: { id } },
        ],
        awaitRefetchQueries: true,
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error('Errore nell\'aggiornamento del template palestra');
          }
          return result.data.updateGymPatternGroup;
        })
      );
  }

  /**
   * Elimina un GymPatternGroup
   */
  delete(id: string): Observable<boolean> {
    return this.apollo
      .mutate<{ deleteGymPatternGroup: boolean }>({
        mutation: DELETE_GYM_PATTERN_GROUP,
        variables: { id },
        refetchQueries: [{ query: GET_GYM_PATTERN_GROUPS }],
        awaitRefetchQueries: true,
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error('Errore nell\'eliminazione del template palestra');
          }
          return result.data.deleteGymPatternGroup;
        })
      );
  }

  /**
   * Attiva un GymPatternGroup (imposta come corrente per la palestra)
   */
  activate(id: string): Observable<GymPatternGroup> {
    return this.apollo
      .mutate<{ activateGymPatternGroup: GymPatternGroup }>({
        mutation: ACTIVATE_GYM_PATTERN_GROUP,
        variables: { id },
        refetchQueries: [{ query: GET_GYM_PATTERN_GROUPS }],
        awaitRefetchQueries: true,
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error('Errore nell\'attivazione del template palestra');
          }
          return result.data.activateGymPatternGroup;
        })
      );
  }

  /**
   * Disattiva un GymPatternGroup
   */
  deactivate(id: string): Observable<GymPatternGroup> {
    return this.apollo
      .mutate<{ deactivateGymPatternGroup: GymPatternGroup }>({
        mutation: DEACTIVATE_GYM_PATTERN_GROUP,
        variables: { id },
        refetchQueries: [{ query: GET_GYM_PATTERN_GROUPS }],
        awaitRefetchQueries: true,
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error('Errore nella disattivazione del template palestra');
          }
          return result.data.deactivateGymPatternGroup;
        })
      );
  }

  /**
   * Duplica un GymPatternGroup con un nuovo nome
   */
  duplicate(id: string, name: string): Observable<GymPatternGroup> {
    return this.apollo
      .mutate<{ duplicateGymPatternGroup: GymPatternGroup }>({
        mutation: DUPLICATE_GYM_PATTERN_GROUP,
        variables: { id, newName: name },
        refetchQueries: [{ query: GET_GYM_PATTERN_GROUPS }],
        awaitRefetchQueries: true,
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error('Errore nella duplicazione del template palestra');
          }
          return result.data.duplicateGymPatternGroup;
        })
      );
  }
}
