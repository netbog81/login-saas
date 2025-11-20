import { Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Observable, map } from 'rxjs';
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
export class ServiceService {
  constructor(private apollo: Apollo) {}

  getServices(): Observable<Service[]> {
    return this.apollo
      .watchQuery<{ services: Service[] }>({
        query: GET_SERVICES,
        fetchPolicy: 'cache-and-network'
      })
      .valueChanges.pipe(
        map(result => (result.data?.services || []) as Service[])
      );
  }

  getService(id: string): Observable<Service | null> {
    return this.apollo
      .watchQuery<{ service: Service | null }>({
        query: GET_SERVICE,
        variables: { id }
      })
      .valueChanges.pipe(
        map(result => (result.data?.service || null) as Service | null)
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
      isActive: input.isActive
    };

    console.log('ServiceService.createService - sending variables:', variables);

    return this.apollo
      .mutate<{ createService: Service }>({
        mutation: CREATE_SERVICE,
        variables,
        refetchQueries: [{ query: GET_SERVICES }]
      })
      .pipe(
        map(result => {
          console.log('ServiceService.createService - received result:', result);
          if (!result.data) {
            throw new Error('Failed to create service');
          }
          return result.data.createService;
        })
      );
  }

  updateService(id: string, input: UpdateServiceInput): Observable<Service> {
    return this.apollo
      .mutate<{ updateService: Service }>({
        mutation: UPDATE_SERVICE,
        variables: {
          id,
          name: input.name,
          description: input.description,
          defaultDuration: input.defaultDuration,
          defaultPrice: input.defaultPrice,
          bufferTimeBefore: input.bufferTimeBefore,
          bufferTimeAfter: input.bufferTimeAfter,
          color: input.color,
          isActive: input.isActive
        },
        refetchQueries: [
          { query: GET_SERVICES },
          { query: GET_SERVICE, variables: { id } }
        ]
      })
      .pipe(
        map(result => {
          if (!result.data) {
            throw new Error('Failed to update service');
          }
          return result.data.updateService;
        })
      );
  }

  deleteService(id: string): Observable<boolean> {
    return this.apollo
      .mutate<{ deleteService: boolean }>({
        mutation: DELETE_SERVICE,
        variables: { id },
        refetchQueries: [{ query: GET_SERVICES }],
        update: (cache) => {
          // Remove the deleted service from cache
          const data = cache.readQuery<{ services: Service[] }>({
            query: GET_SERVICES
          });
          if (data) {
            cache.writeQuery({
              query: GET_SERVICES,
              data: {
                services: data.services.filter(s => s.id !== id)
              }
            });
          }
        }
      })
      .pipe(
        map(result => {
          if (!result.data) {
            throw new Error('Failed to delete service');
          }
          return result.data.deleteService;
        })
      );
  }

  getOperatorServices(operatorId: string): Observable<OperatorService[]> {
    return this.apollo
      .watchQuery<{ operatorServices: OperatorService[] }>({
        query: GET_OPERATOR_SERVICES,
        variables: { operatorId },
        fetchPolicy: 'network-only'
      })
      .valueChanges.pipe(
        map(result => (result.data?.operatorServices || []) as OperatorService[])
      );
  }

  getServiceOperators(serviceId: string): Observable<OperatorService[]> {
    return this.apollo
      .watchQuery<{ serviceOperators: OperatorService[] }>({
        query: GET_SERVICE_OPERATORS,
        variables: { serviceId },
        fetchPolicy: 'network-only'
      })
      .valueChanges.pipe(
        map(result => (result.data?.serviceOperators || []) as OperatorService[])
      );
  }

  assignServiceToOperator(input: AssignServiceToOperatorInput): Observable<OperatorService> {
    return this.apollo
      .mutate<{ assignServiceToOperator: OperatorService }>({
        mutation: ASSIGN_SERVICE_TO_OPERATOR,
        variables: input,
        refetchQueries: [
          { query: GET_OPERATOR_SERVICES, variables: { operatorId: input.operatorId } },
          { query: GET_SERVICE_OPERATORS, variables: { serviceId: input.serviceId } }
        ]
      })
      .pipe(
        map(result => {
          if (!result.data) {
            throw new Error('Failed to assign service to operator');
          }
          return result.data.assignServiceToOperator;
        })
      );
  }

  updateOperatorService(input: UpdateOperatorServiceInput): Observable<OperatorService> {
    return this.apollo
      .mutate<{ updateOperatorService: OperatorService }>({
        mutation: UPDATE_OPERATOR_SERVICE,
        variables: input,
        refetchQueries: [
          { query: GET_OPERATOR_SERVICES, variables: { operatorId: input.operatorId } },
          { query: GET_SERVICE_OPERATORS, variables: { serviceId: input.serviceId } }
        ]
      })
      .pipe(
        map(result => {
          if (!result.data) {
            throw new Error('Failed to update operator service');
          }
          return result.data.updateOperatorService;
        })
      );
  }

  removeServiceFromOperator(operatorId: string, serviceId: string): Observable<boolean> {
    return this.apollo
      .mutate<{ removeServiceFromOperator: boolean }>({
        mutation: REMOVE_SERVICE_FROM_OPERATOR,
        variables: { operatorId, serviceId },
        refetchQueries: [
          { query: GET_OPERATOR_SERVICES, variables: { operatorId } },
          { query: GET_SERVICE_OPERATORS, variables: { serviceId } }
        ]
      })
      .pipe(
        map(result => {
          if (!result.data) {
            throw new Error('Failed to remove service from operator');
          }
          return result.data.removeServiceFromOperator;
        })
      );
  }
}