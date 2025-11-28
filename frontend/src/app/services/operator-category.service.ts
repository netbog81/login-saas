import { Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Observable, map } from 'rxjs';
import {
  GET_OPERATOR_CATEGORIES,
  GET_OPERATOR_CATEGORY,
} from '../graphql/operations/operator-category.queries';
import {
  CREATE_OPERATOR_CATEGORY,
  UPDATE_OPERATOR_CATEGORY,
  DELETE_OPERATOR_CATEGORY,
} from '../graphql/operations/operator-category.mutations';
import {
  OperatorCategory,
  OperatorMacroCategory,
} from '../graphql/generated/types';
import {
  CreateOperatorCategoryInput,
  UpdateOperatorCategoryInput,
} from '../graphql/types';

@Injectable({
  providedIn: 'root',
})
export class OperatorCategoryService {
  constructor(private apollo: Apollo) {}

  /**
   * Ottiene tutte le categorie operatore, opzionalmente filtrate per macroCategory
   */
  getOperatorCategories(
    macroCategory?: OperatorMacroCategory
  ): Observable<OperatorCategory[]> {
    return this.apollo
      .query<{ operatorCategories: OperatorCategory[] }>({
        query: GET_OPERATOR_CATEGORIES,
        variables: { macroCategory },
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => result.data?.operatorCategories || []));
  }

  /**
   * Ottiene una singola categoria operatore per ID
   */
  getOperatorCategory(id: string): Observable<OperatorCategory | null> {
    return this.apollo
      .query<{ operatorCategory: OperatorCategory }>({
        query: GET_OPERATOR_CATEGORY,
        variables: { id },
        fetchPolicy: 'network-only',
      })
      .pipe(map((result) => result.data?.operatorCategory || null));
  }

  /**
   * Crea una nuova categoria operatore
   */
  createOperatorCategory(
    input: CreateOperatorCategoryInput
  ): Observable<OperatorCategory> {
    return this.apollo
      .mutate<{ createOperatorCategory: OperatorCategory }>({
        mutation: CREATE_OPERATOR_CATEGORY,
        variables: input,
        refetchQueries: [{ query: GET_OPERATOR_CATEGORIES }],
        awaitRefetchQueries: true,
      })
      .pipe(map((result) => result.data!.createOperatorCategory));
  }

  /**
   * Aggiorna una categoria operatore esistente
   */
  updateOperatorCategory(
    id: string,
    input: UpdateOperatorCategoryInput
  ): Observable<OperatorCategory> {
    return this.apollo
      .mutate<{ updateOperatorCategory: OperatorCategory }>({
        mutation: UPDATE_OPERATOR_CATEGORY,
        variables: { id, ...input },
        refetchQueries: [{ query: GET_OPERATOR_CATEGORIES }],
        awaitRefetchQueries: true,
      })
      .pipe(map((result) => result.data!.updateOperatorCategory));
  }

  /**
   * Elimina una categoria operatore
   */
  deleteOperatorCategory(id: string): Observable<boolean> {
    return this.apollo
      .mutate<{ deleteOperatorCategory: boolean }>({
        mutation: DELETE_OPERATOR_CATEGORY,
        variables: { id },
        refetchQueries: [{ query: GET_OPERATOR_CATEGORIES }],
        awaitRefetchQueries: true,
      })
      .pipe(map((result) => result.data!.deleteOperatorCategory));
  }
}
