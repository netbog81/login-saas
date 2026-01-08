import { Injectable, Injector } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BaseGraphQLService } from '../core/services/base-graphql.service';
import {
  Service,
  OperatorService,
  MutationCreateServiceArgs as CreateServiceInput,
  MutationUpdateServiceArgs as UpdateServiceInput,
  MutationAssignServiceToOperatorArgs as AssignServiceToOperatorInput,
  MutationUpdateOperatorServiceArgs as UpdateOperatorServiceInput
} from '../graphql/generated/types';
import {
  GET_SERVICES,
  GET_SERVICE,
  GET_OPERATOR_SERVICES,
  GET_SERVICE_OPERATORS
} from '../graphql/operations/service.queries';
import {
  CREATE_SERVICE,
  UPDATE_SERVICE,
  DELETE_SERVICE,
  ASSIGN_SERVICE_TO_OPERATOR,
  UPDATE_OPERATOR_SERVICE,
  REMOVE_SERVICE_FROM_OPERATOR
} from '../graphql/operations/service.mutations';

@Injectable({
  providedIn: 'root'
})
export class ServiceService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  getServices(): Observable<Service[]> {
    return this.watch<{ services: Service[] }>(
      GET_SERVICES
    ).pipe(
      map(result => (result.services || []) as Service[])
    );
  }

  getService(id: string): Observable<Service | null> {
    return this.watch<{ service: Service | null }>(
      GET_SERVICE,
      { id }
    ).pipe(
      map(result => (result.service || null) as Service | null)
    );
  }

  createService(input: CreateServiceInput): Observable<Service> {
    const variables = {
      name: input.name,
      description: input.description,
      defaultDuration: input.defaultDuration,
      defaultPrice: input.defaultPrice,
      bufferTimeBefore: input.bufferTimeBefore,
      bufferTimeAfter: input.bufferTimeAfter,
      color: input.color,
      isActive: input.isActive,
      macroCategory: input.macroCategory,
      subcategoryId: (input as any).subcategoryId,
      discountFE: (input as any).discountFE
    };

    console.log('ServiceService.createService - sending variables:', variables);

    return this.mutate<{ createService: Service }>(
      CREATE_SERVICE,
      variables,
      [{ query: GET_SERVICES }]
    ).pipe(
      map(result => {
        console.log('ServiceService.createService - received result:', result);
        if (!result.createService) {
          throw new Error('Failed to create service');
        }
        return result.createService;
      })
    );
  }

  updateService(id: string, input: UpdateServiceInput): Observable<Service> {
    return this.mutate<{ updateService: Service }>(
      UPDATE_SERVICE,
      {
        id,
        name: input.name,
        description: input.description,
        defaultDuration: input.defaultDuration,
        defaultPrice: input.defaultPrice,
        bufferTimeBefore: input.bufferTimeBefore,
        bufferTimeAfter: input.bufferTimeAfter,
        color: input.color,
        isActive: input.isActive,
        macroCategory: input.macroCategory,
        subcategoryId: (input as any).subcategoryId,
        discountFE: (input as any).discountFE
      },
      [
        { query: GET_SERVICES },
        { query: GET_SERVICE, variables: { id } }
      ]
    ).pipe(
      map(result => {
        if (!result.updateService) {
          throw new Error('Failed to update service');
        }
        return result.updateService;
      })
    );
  }

  deleteService(id: string): Observable<boolean> {
    return this.mutate<{ deleteService: boolean }>(
      DELETE_SERVICE,
      { id },
      [{ query: GET_SERVICES }]
    ).pipe(
      map(result => {
        if (result.deleteService === undefined) {
          throw new Error('Failed to delete service');
        }
        return result.deleteService;
      })
    );
  }

  getOperatorServices(operatorId: string): Observable<OperatorService[]> {
    return this.query<{ operatorServices: OperatorService[] }>(
      GET_OPERATOR_SERVICES,
      { operatorId }
    ).pipe(
      map(result => (result.operatorServices || []) as OperatorService[])
    );
  }

  getServiceOperators(serviceId: string): Observable<OperatorService[]> {
    return this.query<{ serviceOperators: OperatorService[] }>(
      GET_SERVICE_OPERATORS,
      { serviceId }
    ).pipe(
      map(result => (result.serviceOperators || []) as OperatorService[])
    );
  }

  assignServiceToOperator(input: AssignServiceToOperatorInput): Observable<OperatorService> {
    return this.mutate<{ assignServiceToOperator: OperatorService }>(
      ASSIGN_SERVICE_TO_OPERATOR,
      input,
      [
        { query: GET_OPERATOR_SERVICES, variables: { operatorId: input.operatorId } },
        { query: GET_SERVICE_OPERATORS, variables: { serviceId: input.serviceId } }
      ]
    ).pipe(
      map(result => {
        if (!result.assignServiceToOperator) {
          throw new Error('Failed to assign service to operator');
        }
        return result.assignServiceToOperator;
      })
    );
  }

  updateOperatorService(input: UpdateOperatorServiceInput): Observable<OperatorService> {
    return this.mutate<{ updateOperatorService: OperatorService }>(
      UPDATE_OPERATOR_SERVICE,
      input,
      [
        { query: GET_OPERATOR_SERVICES, variables: { operatorId: input.operatorId } },
        { query: GET_SERVICE_OPERATORS, variables: { serviceId: input.serviceId } }
      ]
    ).pipe(
      map(result => {
        if (!result.updateOperatorService) {
          throw new Error('Failed to update operator service');
        }
        return result.updateOperatorService;
      })
    );
  }

  removeServiceFromOperator(operatorId: string, serviceId: string): Observable<boolean> {
    return this.mutate<{ removeServiceFromOperator: boolean }>(
      REMOVE_SERVICE_FROM_OPERATOR,
      { operatorId, serviceId },
      [
        { query: GET_OPERATOR_SERVICES, variables: { operatorId } },
        { query: GET_SERVICE_OPERATORS, variables: { serviceId } }
      ]
    ).pipe(
      map(result => {
        if (result.removeServiceFromOperator === undefined) {
          throw new Error('Failed to remove service from operator');
        }
        return result.removeServiceFromOperator;
      })
    );
  }
}
