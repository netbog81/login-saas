import { Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Observable, map } from 'rxjs';
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
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class ServiceSubcategoryService {
  constructor(private apollo: Apollo) {}

  getServiceSubcategories(macroCategory?: OperatorMacroCategory, onlyActive?: boolean): Observable<ServiceSubcategory[]> {
    return this.apollo
      .watchQuery<{ serviceSubcategories: ServiceSubcategory[] }>({
        query: GET_SERVICE_SUBCATEGORIES,
        variables: { macroCategory, onlyActive },
        fetchPolicy: 'cache-and-network'
      })
      .valueChanges.pipe(
        map(result => (result.data?.serviceSubcategories || []) as ServiceSubcategory[])
      );
  }

  getServiceSubcategory(id: string): Observable<ServiceSubcategory | null> {
    return this.apollo
      .watchQuery<{ serviceSubcategory: ServiceSubcategory | null }>({
        query: GET_SERVICE_SUBCATEGORY,
        variables: { id }
      })
      .valueChanges.pipe(
        map(result => (result.data?.serviceSubcategory || null) as ServiceSubcategory | null)
      );
  }

  createServiceSubcategory(
    macroCategory: OperatorMacroCategory,
    name: string,
    description?: string
  ): Observable<ServiceSubcategory> {
    return this.apollo
      .mutate<{ createServiceSubcategory: ServiceSubcategory }>({
        mutation: CREATE_SERVICE_SUBCATEGORY,
        variables: { macroCategory, name, description },
        refetchQueries: [{ query: GET_SERVICE_SUBCATEGORIES }]
      })
      .pipe(
        map(result => {
          if (!result.data) {
            throw new Error('Errore durante la creazione della sottocategoria');
          }
          return result.data.createServiceSubcategory;
        })
      );
  }

  updateServiceSubcategory(
    id: string,
    name?: string,
    description?: string,
    isActive?: boolean
  ): Observable<ServiceSubcategory> {
    return this.apollo
      .mutate<{ updateServiceSubcategory: ServiceSubcategory }>({
        mutation: UPDATE_SERVICE_SUBCATEGORY,
        variables: { id, name, description, isActive },
        refetchQueries: [
          { query: GET_SERVICE_SUBCATEGORIES },
          { query: GET_SERVICE_SUBCATEGORY, variables: { id } }
        ]
      })
      .pipe(
        map(result => {
          if (!result.data) {
            throw new Error('Errore durante l\'aggiornamento della sottocategoria');
          }
          return result.data.updateServiceSubcategory;
        })
      );
  }

  deleteServiceSubcategory(id: string): Observable<boolean> {
    return this.apollo
      .mutate<{ deleteServiceSubcategory: boolean }>({
        mutation: DELETE_SERVICE_SUBCATEGORY,
        variables: { id },
        refetchQueries: [{ query: GET_SERVICE_SUBCATEGORIES }]
      })
      .pipe(
        map(result => {
          if (!result.data) {
            throw new Error('Errore durante l\'eliminazione della sottocategoria');
          }
          return result.data.deleteServiceSubcategory;
        })
      );
  }
}
