import { Injectable, Injector } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BaseGraphQLService } from '../core/services/base-graphql.service';
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
export class OperatorCategoryService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  /**
   * Ottiene tutte le categorie operatore, opzionalmente filtrate per macroCategory
   */
  getOperatorCategories(
    macroCategory?: OperatorMacroCategory
  ): Observable<OperatorCategory[]> {
    return this.query<{ operatorCategories: OperatorCategory[] }>(
      GET_OPERATOR_CATEGORIES,
      { macroCategory }
    ).pipe(map((result) => result.operatorCategories || []));
  }

  /**
   * Ottiene una singola categoria operatore per ID
   */
  getOperatorCategory(id: string): Observable<OperatorCategory | null> {
    return this.query<{ operatorCategory: OperatorCategory }>(
      GET_OPERATOR_CATEGORY,
      { id }
    ).pipe(map((result) => result.operatorCategory || null));
  }

  /**
   * Crea una nuova categoria operatore
   */
  createOperatorCategory(
    input: CreateOperatorCategoryInput
  ): Observable<OperatorCategory> {
    return this.mutate<{ createOperatorCategory: OperatorCategory }>(
      CREATE_OPERATOR_CATEGORY,
      input,
      [{ query: GET_OPERATOR_CATEGORIES }]
    ).pipe(map((result) => result.createOperatorCategory));
  }

  /**
   * Aggiorna una categoria operatore esistente
   */
  updateOperatorCategory(
    id: string,
    input: UpdateOperatorCategoryInput
  ): Observable<OperatorCategory> {
    return this.mutate<{ updateOperatorCategory: OperatorCategory }>(
      UPDATE_OPERATOR_CATEGORY,
      { id, ...input },
      [{ query: GET_OPERATOR_CATEGORIES }]
    ).pipe(map((result) => result.updateOperatorCategory));
  }

  /**
   * Elimina una categoria operatore
   */
  deleteOperatorCategory(id: string): Observable<boolean> {
    return this.mutate<{ deleteOperatorCategory: boolean }>(
      DELETE_OPERATOR_CATEGORY,
      { id },
      [{ query: GET_OPERATOR_CATEGORIES }]
    ).pipe(map((result) => result.deleteOperatorCategory));
  }
}
