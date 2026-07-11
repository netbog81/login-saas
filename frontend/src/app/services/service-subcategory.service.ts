import { Injectable, Injector } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BaseGraphQLService } from '../core/services/base-graphql.service';
import { OperatorMacroCategory } from '../graphql/generated/types';
import {
  GET_SERVICE_SUBCATEGORIES,
  GET_SERVICE_SUBCATEGORY
} from '../graphql/operations/service-subcategory.queries';
import {
  CREATE_SERVICE_SUBCATEGORY,
  UPDATE_SERVICE_SUBCATEGORY,
  DELETE_SERVICE_SUBCATEGORY
} from '../graphql/operations/service-subcategory.mutations';

export interface ServiceSubcategory {
  id: string;
  macroCategory: OperatorMacroCategory;
  name: string;
  description?: string;
  /** Descrizione che sarà inserita nelle righe fattura. */
  invoiceLineDescription?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class ServiceSubcategoryService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  getServiceSubcategories(macroCategory?: OperatorMacroCategory, onlyActive?: boolean): Observable<ServiceSubcategory[]> {
    return this.watch<{ serviceSubcategories: ServiceSubcategory[] }>(
      GET_SERVICE_SUBCATEGORIES,
      { macroCategory, onlyActive }
    ).pipe(
      map(result => (result.serviceSubcategories || []) as ServiceSubcategory[])
    );
  }

  getServiceSubcategory(id: string): Observable<ServiceSubcategory | null> {
    return this.watch<{ serviceSubcategory: ServiceSubcategory | null }>(
      GET_SERVICE_SUBCATEGORY,
      { id }
    ).pipe(
      map(result => (result.serviceSubcategory || null) as ServiceSubcategory | null)
    );
  }

  createServiceSubcategory(
    macroCategory: OperatorMacroCategory,
    name: string,
    description?: string,
    invoiceLineDescription?: string
  ): Observable<ServiceSubcategory> {
    return this.mutate<{ createServiceSubcategory: ServiceSubcategory }>(
      CREATE_SERVICE_SUBCATEGORY,
      { macroCategory, name, description, invoiceLineDescription },
      [{ query: GET_SERVICE_SUBCATEGORIES }]
    ).pipe(
      map(result => {
        if (!result.createServiceSubcategory) {
          throw new Error('Errore durante la creazione della sottocategoria');
        }
        return result.createServiceSubcategory;
      })
    );
  }

  updateServiceSubcategory(
    id: string,
    name?: string,
    description?: string,
    isActive?: boolean,
    invoiceLineDescription?: string
  ): Observable<ServiceSubcategory> {
    return this.mutate<{ updateServiceSubcategory: ServiceSubcategory }>(
      UPDATE_SERVICE_SUBCATEGORY,
      { id, name, description, invoiceLineDescription, isActive },
      [
        { query: GET_SERVICE_SUBCATEGORIES },
        { query: GET_SERVICE_SUBCATEGORY, variables: { id } }
      ]
    ).pipe(
      map(result => {
        if (!result.updateServiceSubcategory) {
          throw new Error('Errore durante l\'aggiornamento della sottocategoria');
        }
        return result.updateServiceSubcategory;
      })
    );
  }

  deleteServiceSubcategory(id: string): Observable<boolean> {
    return this.mutate<{ deleteServiceSubcategory: boolean }>(
      DELETE_SERVICE_SUBCATEGORY,
      { id },
      [{ query: GET_SERVICE_SUBCATEGORIES }]
    ).pipe(
      map(result => {
        if (result.deleteServiceSubcategory === undefined) {
          throw new Error('Errore durante l\'eliminazione della sottocategoria');
        }
        return result.deleteServiceSubcategory;
      })
    );
  }
}
