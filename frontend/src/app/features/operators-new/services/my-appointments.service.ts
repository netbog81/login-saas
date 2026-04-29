import { Injectable, Injector } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { BaseGraphQLService } from '../../../core/services/base-graphql.service';
import { GET_MY_APPOINTMENTS } from '../graphql/my-appointments.operations';
import { MyAppointment } from '../models/my-appointments.model';
import {
  MyAppointmentsFilters,
  MY_APPOINTMENTS_DEFAULT_RANGE,
} from '../models/my-appointments-filter.model';

/**
 * Service "I miei appuntamenti" — Layer 3.
 *
 * APPROACH FK: GraphQL Fragments (default) — vedi MY_APPOINTMENT_FIELDS.
 * REASON: backend supporta resolver per patient/service, single query.
 *
 * Il filtro server-side è solo sul range data + operatore. Status e
 * paziente sono filtrati lato container in memoria — dataset operatore
 * di dimensioni gestibili e mantengo la query semplice/cacheable.
 */
@Injectable({ providedIn: 'root' })
export class MyAppointmentsService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  /**
   * Carica gli appuntamenti dell'operatore corrente nel range richiesto.
   * Se filters.dateFrom/To non sono specificati usa il range storico
   * esteso (1900–2100) per ottenere "tutti".
   */
  getMyAppointments(
    operatorId: string,
    filters?: Pick<MyAppointmentsFilters, 'dateFrom' | 'dateTo'>,
  ): Observable<MyAppointment[]> {
    const startDate = filters?.dateFrom ?? MY_APPOINTMENTS_DEFAULT_RANGE.dateFrom;
    const endDate = filters?.dateTo ?? MY_APPOINTMENTS_DEFAULT_RANGE.dateTo;

    return this.query<{
      availabilityAppointmentsByOperator: MyAppointment[];
    }>(GET_MY_APPOINTMENTS, { operatorId, startDate, endDate }).pipe(
      // ApolloZoneService può emettere `undefined` quando la query ritorna
      // errori GraphQL (lascia passare tutto e delega al consumer): qui
      // gestiamo il caso ritornando lista vuota invece di crashare con
      // "Cannot read properties of undefined".
      map(r => r?.availabilityAppointmentsByOperator ?? []),
    );
  }
}
