import { gql } from 'apollo-angular';

/**
 * Fragment per la lista "I miei appuntamenti".
 *
 * NB: lo schema GraphQL del backend NON espone la relazione `patient`
 * direttamente sull'AvailabilityAppointment (vedi commenti su
 * availability-appointment.entity.ts: la relazione TypeORM esiste ma
 * manca il `@Field()` di GraphQL). Per il nome del paziente il backend
 * mantiene una colonna denormalizzata `clientName` (sempre popolata) +
 * `clientPhone`. Usiamo questi campi: niente lookup aggiuntiva, single
 * round-trip mantenuto.
 *
 * Approach FK: campi denormalizzati (allineato al pattern esistente
 * AVAILABILITY_APPOINTMENT_FIELDS usato da patient-appointments-dialog).
 */
export const MY_APPOINTMENT_FIELDS = gql`
  fragment MyAppointmentFields on AvailabilityAppointment {
    id
    appointmentDate
    startTime
    endTime
    bookingStatus
    notes
    patientId
    clientName
    clientPhone
    service {
      id
      name
      defaultDuration
    }
  }
`;

/**
 * Query operatore-scoped: usa il resolver esistente
 * `availabilityAppointmentsByOperator(operatorId, startDate, endDate)`.
 *
 * Il container fornisce sempre un range data (default ampio se l'utente
 * non filtra). Lo status e il paziente sono filtri client-side: il
 * dataset di un operatore tipicamente sta nell'ordine delle migliaia,
 * il filtraggio in memoria è accettabile e tiene la query semplice.
 */
export const GET_MY_APPOINTMENTS = gql`
  query GetMyAppointments(
    $operatorId: ID!
    $startDate: String!
    $endDate: String!
  ) {
    availabilityAppointmentsByOperator(
      operatorId: $operatorId
      startDate: $startDate
      endDate: $endDate
    ) {
      ...MyAppointmentFields
    }
  }
  ${MY_APPOINTMENT_FIELDS}
`;
