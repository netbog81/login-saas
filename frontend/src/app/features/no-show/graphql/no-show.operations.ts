import { gql } from 'apollo-angular';

/**
 * Operations GraphQL della sezione Statistiche → No Show.
 * Il suffisso `NoShow` sui nomi evita collisioni col codegen.
 */

const NO_SHOW_COUNTS_FIELDS = gql`
  fragment NoShowCountsFields on NoShowCounts {
    noShow
    cancelledLate
    cancelledEarly
    cancelledUnknown
    lateArrival
    unjustified
    total
  }
`;

const NO_SHOW_EVENT_FIELDS = gql`
  fragment NoShowEventFields on NoShowEvent {
    appointmentId
    patientId
    patientName
    eventType
    bookingStatus
    appointmentDate
    startTime
    endTime
    appointmentType
    gymRoomName
    siteId
    siteName
    operatorId
    operatorName
    operatorMacroCategory
    isSubstitution
    originalOperatorName
    cancelledAt
    cancellationHoursNotice
    cancellationReason
    arrivedAt
    lateMinutes
    arrivalSource
    wasNoShowReverted
    serviceNames
    review {
      id
      appointmentId
      decision
      notes
      chargedAmount
      decidedByName
      decidedAt
    }
  }
`;

/** KPI del periodo/filtro corrente. */
export const NO_SHOW_SUMMARY = gql`
  query NoShowSummary($filter: NoShowFilterInput) {
    noShowSummary(filter: $filter) {
      counts {
        ...NoShowCountsFields
      }
      patientsInvolved
      pendingReviews
      toCharge
      waived
      justified
      lateCancellationHours
      lateArrivalToleranceMinutes
      recentWindowDays
    }
  }
  ${NO_SHOW_COUNTS_FIELDS}
`;

/** Vista ad albero: un nodo per paziente con i suoi eventi. */
export const NO_SHOW_BY_PATIENT = gql`
  query NoShowByPatient($filter: NoShowFilterInput, $paging: NoShowPagingInput) {
    noShowByPatient(filter: $filter, paging: $paging) {
      totalPatients
      groups {
        patientId
        patientName
        firstEventDate
        lastEventDate
        pendingReviews
        counts {
          ...NoShowCountsFields
        }
        recent {
          ...NoShowCountsFields
        }
        rollingYear {
          ...NoShowCountsFields
        }
        events {
          ...NoShowEventFields
        }
      }
    }
  }
  ${NO_SHOW_COUNTS_FIELDS}
  ${NO_SHOW_EVENT_FIELDS}
`;

/** Elenco piatto, dal più recente. */
export const NO_SHOW_EVENTS = gql`
  query NoShowEvents($filter: NoShowFilterInput, $paging: NoShowPagingInput) {
    noShowEvents(filter: $filter, paging: $paging) {
      total
      events {
        ...NoShowEventFields
      }
    }
  }
  ${NO_SHOW_EVENT_FIELDS}
`;

/** Decisione dello staff (addebita / esonera / giustifica). */
export const UPSERT_NO_SHOW_REVIEW = gql`
  mutation UpsertNoShowReview($input: UpsertNoShowReviewInput!) {
    upsertNoShowReview(input: $input) {
      id
      appointmentId
      decision
      notes
      chargedAmount
      decidedByName
      decidedAt
    }
  }
`;

export const DELETE_NO_SHOW_REVIEW = gql`
  mutation DeleteNoShowReview($appointmentId: ID!) {
    deleteNoShowReview(appointmentId: $appointmentId)
  }
`;
