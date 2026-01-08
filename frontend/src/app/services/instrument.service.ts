import { Injectable, Injector } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BaseGraphQLService } from '../core/services/base-graphql.service';
import {
  Instrument,
  InstrumentCategory,
  InstrumentStatus,
  OperatorMacroCategory,
} from '../graphql/generated/types';
import {
  GET_INSTRUMENTS,
  GET_INSTRUMENT,
  GET_INSTRUMENT_CATEGORIES,
  GET_INSTRUMENT_CATEGORY,
  GET_AVAILABLE_INSTRUMENTS_BY_CATEGORY,
} from '../graphql/operations/instrument.queries';
import {
  CREATE_INSTRUMENT,
  UPDATE_INSTRUMENT,
  SET_INSTRUMENT_STATUS,
  DELETE_INSTRUMENT,
  CREATE_INSTRUMENT_CATEGORY,
  UPDATE_INSTRUMENT_CATEGORY,
  DELETE_INSTRUMENT_CATEGORY,
} from '../graphql/operations/instrument.mutations';

export interface CreateInstrumentInput {
  categoryId: string;
  name: string;
  brand?: string;
  model?: string;
  verificationExpiry?: Date;
  technicalData?: Record<string, unknown>;
  color?: string;
}

export interface UpdateInstrumentInput {
  name?: string;
  categoryId?: string;
  brand?: string;
  model?: string;
  verificationExpiry?: Date;
  status?: InstrumentStatus;
  technicalData?: Record<string, unknown>;
  color?: string;
  isActive?: boolean;
}

export interface CreateInstrumentCategoryInput {
  name: string;
  description?: string;
  macroCategory?: OperatorMacroCategory;
}

export interface UpdateInstrumentCategoryInput {
  name?: string;
  description?: string;
  macroCategory?: OperatorMacroCategory;
  isActive?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class InstrumentService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  // ============ INSTRUMENTS ============

  /**
   * Ottiene tutti gli strumenti con filtri opzionali
   */
  getInstruments(
    categoryId?: string,
    status?: InstrumentStatus
  ): Observable<Instrument[]> {
    return this.query<{ instruments: Instrument[] }>(
      GET_INSTRUMENTS,
      { categoryId, status }
    ).pipe(map((result) => result.instruments || []));
  }

  /**
   * Ottiene un singolo strumento per ID
   */
  getInstrument(id: string): Observable<Instrument | null> {
    return this.query<{ instrument: Instrument | null }>(
      GET_INSTRUMENT,
      { id }
    ).pipe(map((result) => result.instrument || null));
  }

  /**
   * Ottiene strumenti disponibili per categoria (solo ACTIVE e isActive=true)
   */
  getAvailableInstrumentsByCategory(categoryId: string): Observable<Instrument[]> {
    return this.query<{ availableInstrumentsByCategory: Instrument[] }>(
      GET_AVAILABLE_INSTRUMENTS_BY_CATEGORY,
      { categoryId }
    ).pipe(map((result) => result.availableInstrumentsByCategory || []));
  }

  /**
   * Crea un nuovo strumento
   */
  createInstrument(input: CreateInstrumentInput): Observable<Instrument> {
    // Convert Date to ISO string for GraphQL DateTime scalar
    // Handle both Date objects and string inputs
    let verificationExpiryValue: string | undefined = undefined;
    if (input.verificationExpiry) {
      verificationExpiryValue = input.verificationExpiry instanceof Date
        ? input.verificationExpiry.toISOString()
        : new Date(input.verificationExpiry).toISOString();
    }

    const { verificationExpiry, ...restInput } = input;
    const variables = {
      ...restInput,
      ...(verificationExpiryValue && { verificationExpiry: verificationExpiryValue }),
    };

    return this.mutate<{ createInstrument: Instrument }>(
      CREATE_INSTRUMENT,
      variables,
      [{ query: GET_INSTRUMENTS }, { query: GET_INSTRUMENT_CATEGORIES }]
    ).pipe(
      map((result) => {
        if (!result.createInstrument) {
          throw new Error('Failed to create instrument');
        }
        return result.createInstrument;
      })
    );
  }

  /**
   * Aggiorna uno strumento esistente
   */
  updateInstrument(id: string, input: UpdateInstrumentInput): Observable<Instrument> {
    // Convert Date to ISO string for GraphQL DateTime scalar
    // Handle both Date objects and string inputs
    let verificationExpiryValue: string | undefined = undefined;
    if (input.verificationExpiry) {
      verificationExpiryValue = input.verificationExpiry instanceof Date
        ? input.verificationExpiry.toISOString()
        : new Date(input.verificationExpiry).toISOString();
    }

    const { verificationExpiry, ...restInput } = input;
    const variables = {
      id,
      ...restInput,
      ...(verificationExpiryValue && { verificationExpiry: verificationExpiryValue }),
    };

    return this.mutate<{ updateInstrument: Instrument }>(
      UPDATE_INSTRUMENT,
      variables,
      [
        { query: GET_INSTRUMENTS },
        { query: GET_INSTRUMENT, variables: { id } },
        { query: GET_INSTRUMENT_CATEGORIES },
      ]
    ).pipe(
      map((result) => {
        if (!result.updateInstrument) {
          throw new Error('Failed to update instrument');
        }
        return result.updateInstrument;
      })
    );
  }

  /**
   * Cambia lo stato di uno strumento
   */
  setInstrumentStatus(id: string, status: InstrumentStatus): Observable<Instrument> {
    return this.mutate<{ setInstrumentStatus: Instrument }>(
      SET_INSTRUMENT_STATUS,
      { id, status },
      [{ query: GET_INSTRUMENTS }, { query: GET_INSTRUMENT_CATEGORIES }]
    ).pipe(
      map((result) => {
        if (!result.setInstrumentStatus) {
          throw new Error('Failed to set instrument status');
        }
        return result.setInstrumentStatus;
      })
    );
  }

  /**
   * Elimina uno strumento
   */
  deleteInstrument(id: string): Observable<boolean> {
    return this.mutate<{ deleteInstrument: boolean }>(
      DELETE_INSTRUMENT,
      { id },
      [{ query: GET_INSTRUMENTS }, { query: GET_INSTRUMENT_CATEGORIES }]
    ).pipe(
      map((result) => {
        if (result.deleteInstrument === undefined) {
          throw new Error('Failed to delete instrument');
        }
        return result.deleteInstrument;
      })
    );
  }

  // ============ INSTRUMENT CATEGORIES ============

  /**
   * Ottiene tutte le categorie strumenti con filtro opzionale per macro-categoria
   */
  getInstrumentCategories(
    macroCategory?: OperatorMacroCategory
  ): Observable<InstrumentCategory[]> {
    return this.query<{ instrumentCategories: InstrumentCategory[] }>(
      GET_INSTRUMENT_CATEGORIES,
      { macroCategory }
    ).pipe(map((result) => result.instrumentCategories || []));
  }

  /**
   * Ottiene una singola categoria strumenti per ID
   */
  getInstrumentCategory(id: string): Observable<InstrumentCategory | null> {
    return this.query<{ instrumentCategory: InstrumentCategory | null }>(
      GET_INSTRUMENT_CATEGORY,
      { id }
    ).pipe(map((result) => result.instrumentCategory || null));
  }

  /**
   * Crea una nuova categoria strumenti
   */
  createInstrumentCategory(
    input: CreateInstrumentCategoryInput
  ): Observable<InstrumentCategory> {
    return this.mutate<{ createInstrumentCategory: InstrumentCategory }>(
      CREATE_INSTRUMENT_CATEGORY,
      input,
      [{ query: GET_INSTRUMENT_CATEGORIES }]
    ).pipe(
      map((result) => {
        if (!result.createInstrumentCategory) {
          throw new Error('Failed to create instrument category');
        }
        return result.createInstrumentCategory;
      })
    );
  }

  /**
   * Aggiorna una categoria strumenti esistente
   */
  updateInstrumentCategory(
    id: string,
    input: UpdateInstrumentCategoryInput
  ): Observable<InstrumentCategory> {
    return this.mutate<{ updateInstrumentCategory: InstrumentCategory }>(
      UPDATE_INSTRUMENT_CATEGORY,
      { id, ...input },
      [
        { query: GET_INSTRUMENT_CATEGORIES },
        { query: GET_INSTRUMENT_CATEGORY, variables: { id } },
      ]
    ).pipe(
      map((result) => {
        if (!result.updateInstrumentCategory) {
          throw new Error('Failed to update instrument category');
        }
        return result.updateInstrumentCategory;
      })
    );
  }

  /**
   * Elimina una categoria strumenti
   */
  deleteInstrumentCategory(id: string): Observable<boolean> {
    return this.mutate<{ deleteInstrumentCategory: boolean }>(
      DELETE_INSTRUMENT_CATEGORY,
      { id },
      [{ query: GET_INSTRUMENT_CATEGORIES }]
    ).pipe(
      map((result) => {
        if (result.deleteInstrumentCategory === undefined) {
          throw new Error('Failed to delete instrument category');
        }
        return result.deleteInstrumentCategory;
      })
    );
  }
}
