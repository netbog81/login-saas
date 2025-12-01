import { Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Observable, map } from 'rxjs';
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
export class InstrumentService {
  constructor(private apollo: Apollo) {}

  // ============ INSTRUMENTS ============

  /**
   * Ottiene tutti gli strumenti con filtri opzionali
   */
  getInstruments(
    categoryId?: string,
    status?: InstrumentStatus
  ): Observable<Instrument[]> {
    return this.apollo
      .query<{ instruments: Instrument[] }>({
        query: GET_INSTRUMENTS,
        variables: { categoryId, status },
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => result.data?.instruments || []));
  }

  /**
   * Ottiene un singolo strumento per ID
   */
  getInstrument(id: string): Observable<Instrument | null> {
    return this.apollo
      .query<{ instrument: Instrument | null }>({
        query: GET_INSTRUMENT,
        variables: { id },
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => result.data?.instrument || null));
  }

  /**
   * Ottiene strumenti disponibili per categoria (solo ACTIVE e isActive=true)
   */
  getAvailableInstrumentsByCategory(categoryId: string): Observable<Instrument[]> {
    return this.apollo
      .query<{ availableInstrumentsByCategory: Instrument[] }>({
        query: GET_AVAILABLE_INSTRUMENTS_BY_CATEGORY,
        variables: { categoryId },
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => result.data?.availableInstrumentsByCategory || []));
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

    return this.apollo
      .mutate<{ createInstrument: Instrument }>({
        mutation: CREATE_INSTRUMENT,
        variables,
        refetchQueries: [{ query: GET_INSTRUMENTS }, { query: GET_INSTRUMENT_CATEGORIES }],
        awaitRefetchQueries: true,
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error('Failed to create instrument');
          }
          return result.data.createInstrument;
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

    return this.apollo
      .mutate<{ updateInstrument: Instrument }>({
        mutation: UPDATE_INSTRUMENT,
        variables,
        refetchQueries: [
          { query: GET_INSTRUMENTS },
          { query: GET_INSTRUMENT, variables: { id } },
          { query: GET_INSTRUMENT_CATEGORIES },
        ],
        awaitRefetchQueries: true,
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error('Failed to update instrument');
          }
          return result.data.updateInstrument;
        })
      );
  }

  /**
   * Cambia lo stato di uno strumento
   */
  setInstrumentStatus(id: string, status: InstrumentStatus): Observable<Instrument> {
    return this.apollo
      .mutate<{ setInstrumentStatus: Instrument }>({
        mutation: SET_INSTRUMENT_STATUS,
        variables: { id, status },
        refetchQueries: [{ query: GET_INSTRUMENTS }, { query: GET_INSTRUMENT_CATEGORIES }],
        awaitRefetchQueries: true,
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error('Failed to set instrument status');
          }
          return result.data.setInstrumentStatus;
        })
      );
  }

  /**
   * Elimina uno strumento
   */
  deleteInstrument(id: string): Observable<boolean> {
    return this.apollo
      .mutate<{ deleteInstrument: boolean }>({
        mutation: DELETE_INSTRUMENT,
        variables: { id },
        refetchQueries: [{ query: GET_INSTRUMENTS }, { query: GET_INSTRUMENT_CATEGORIES }],
        awaitRefetchQueries: true,
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error('Failed to delete instrument');
          }
          return result.data.deleteInstrument;
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
    return this.apollo
      .query<{ instrumentCategories: InstrumentCategory[] }>({
        query: GET_INSTRUMENT_CATEGORIES,
        variables: { macroCategory },
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => result.data?.instrumentCategories || []));
  }

  /**
   * Ottiene una singola categoria strumenti per ID
   */
  getInstrumentCategory(id: string): Observable<InstrumentCategory | null> {
    return this.apollo
      .query<{ instrumentCategory: InstrumentCategory | null }>({
        query: GET_INSTRUMENT_CATEGORY,
        variables: { id },
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => result.data?.instrumentCategory || null));
  }

  /**
   * Crea una nuova categoria strumenti
   */
  createInstrumentCategory(
    input: CreateInstrumentCategoryInput
  ): Observable<InstrumentCategory> {
    return this.apollo
      .mutate<{ createInstrumentCategory: InstrumentCategory }>({
        mutation: CREATE_INSTRUMENT_CATEGORY,
        variables: input,
        refetchQueries: [{ query: GET_INSTRUMENT_CATEGORIES }],
        awaitRefetchQueries: true,
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error('Failed to create instrument category');
          }
          return result.data.createInstrumentCategory;
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
    return this.apollo
      .mutate<{ updateInstrumentCategory: InstrumentCategory }>({
        mutation: UPDATE_INSTRUMENT_CATEGORY,
        variables: { id, ...input },
        refetchQueries: [
          { query: GET_INSTRUMENT_CATEGORIES },
          { query: GET_INSTRUMENT_CATEGORY, variables: { id } },
        ],
        awaitRefetchQueries: true,
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error('Failed to update instrument category');
          }
          return result.data.updateInstrumentCategory;
        })
      );
  }

  /**
   * Elimina una categoria strumenti
   */
  deleteInstrumentCategory(id: string): Observable<boolean> {
    return this.apollo
      .mutate<{ deleteInstrumentCategory: boolean }>({
        mutation: DELETE_INSTRUMENT_CATEGORY,
        variables: { id },
        refetchQueries: [{ query: GET_INSTRUMENT_CATEGORIES }],
        awaitRefetchQueries: true,
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error('Failed to delete instrument category');
          }
          return result.data.deleteInstrumentCategory;
        })
      );
  }
}
