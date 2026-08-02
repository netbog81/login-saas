import { gql } from 'apollo-angular';

export const ABSENCE_EXCEPTION_FRAGMENT = gql`
  fragment AbsenceExceptionFields on AvailabilityException {
    id
    operatorId
    operator {
      id
      name
      surname
      macroCategory
    }
    exceptionDate
    exceptionType
    startTime
    endTime
    reason
    absenceTypeId
    absenceTypeSnapshot {
      id
      name
      description
    }
    sourceGroupId
    createdAt
  }
`;

export const GET_OPERATOR_ABSENCES = gql`
  query GetOperatorAbsences($operatorId: ID, $startDate: String, $endDate: String) {
    availabilityExceptions(operatorId: $operatorId, startDate: $startDate, endDate: $endDate) {
      ...AbsenceExceptionFields
    }
  }
  ${ABSENCE_EXCEPTION_FRAGMENT}
`;

export const PREVIEW_OPERATOR_ABSENCE_IMPACT = gql`
  query PreviewOperatorAbsenceImpact(
    $operatorIds: [ID!]!
    $dateFrom: String!
    $dateTo: String!
    $startTime: String
    $endTime: String
  ) {
    previewOperatorAbsenceImpact(
      operatorIds: $operatorIds
      dateFrom: $dateFrom
      dateTo: $dateTo
      startTime: $startTime
      endTime: $endTime
    ) {
      conflicts {
        id
        appointmentDate
        startTime
        endTime
        clientName
        patientId
        bookingStatus
        operatorId
        operator {
          id
          name
          surname
        }
        service {
          id
          name
        }
      }
      removedAvailabilityCount
      attendedWithoutTreatment {
        id
        appointmentDate
        startTime
        endTime
        clientName
        patientId
        bookingStatus
        operatorId
        operator {
          id
          name
          surname
        }
        service {
          id
          name
        }
      }
    }
  }
`;

export const CREATE_OPERATOR_ABSENCES = gql`
  mutation CreateOperatorAbsences($input: CreateOperatorAbsencesInput!) {
    createOperatorAbsences(input: $input) {
      conflictCount
      skippedOverlaps
      removedAvailabilityCount
      sourceGroupId
      exceptions {
        ...AbsenceExceptionFields
      }
    }
  }
  ${ABSENCE_EXCEPTION_FRAGMENT}
`;

export const DELETE_ABSENCE = gql`
  mutation DeleteAbsence($id: ID!) {
    deleteException(id: $id)
  }
`;

export const DELETE_ABSENCE_GROUP = gql`
  mutation DeleteAbsenceGroup($sourceGroupId: ID!) {
    deleteAbsenceGroup(sourceGroupId: $sourceGroupId)
  }
`;

// ==================== DISPONIBILITÀ STRAORDINARIE ====================

/** Frammento riusato dalle anteprime di rimozione. */
const IMPACTED_APPOINTMENT_FIELDS = `
  id
  appointmentDate
  startTime
  endTime
  clientName
  patientId
  bookingStatus
  operatorId
  operator {
    id
    name
    surname
  }
  service {
    id
    name
  }
`;

export const PREVIEW_OPERATOR_AVAILABILITY_IMPACT = gql`
  query PreviewOperatorAvailabilityImpact($input: CreateOperatorAvailabilityInput!) {
    previewOperatorAvailabilityImpact(input: $input) {
      creatableCount
      blockers {
        operatorId
        operatorName
        date
        reason
      }
      alreadyCovered {
        operatorId
        operatorName
        date
        windows
      }
    }
  }
`;

export const CREATE_OPERATOR_AVAILABILITY = gql`
  mutation CreateOperatorAvailability($input: CreateOperatorAvailabilityInput!) {
    createOperatorAvailability(input: $input) {
      createdCount
      sourceGroupId
      blockers {
        operatorId
        operatorName
        date
        reason
      }
      alreadyCovered {
        operatorId
        operatorName
        date
        windows
      }
      exceptions {
        ...AbsenceExceptionFields
      }
    }
  }
  ${ABSENCE_EXCEPTION_FRAGMENT}
`;

export const PREVIEW_AVAILABILITY_REMOVAL_IMPACT = gql`
  query PreviewAvailabilityRemovalImpact($exceptionIds: [ID!]!) {
    previewAvailabilityRemovalImpact(exceptionIds: $exceptionIds) {
      ${IMPACTED_APPOINTMENT_FIELDS}
    }
  }
`;

export const PREVIEW_GROUP_REMOVAL_IMPACT = gql`
  query PreviewGroupRemovalImpact($sourceGroupId: ID!) {
    previewGroupRemovalImpact(sourceGroupId: $sourceGroupId) {
      ${IMPACTED_APPOINTMENT_FIELDS}
    }
  }
`;

export const DELETE_EXCEPTION_GROUP = gql`
  mutation DeleteExceptionGroup($sourceGroupId: ID!) {
    deleteExceptionGroup(sourceGroupId: $sourceGroupId) {
      deleted
      conflictCount
    }
  }
`;

// ==================== CAMBIO ORARIO ====================

export const PREVIEW_SCHEDULE_CHANGE_IMPACT = gql`
  query PreviewScheduleChangeImpact($input: CreateScheduleChangeInput!) {
    previewScheduleChangeImpact(input: $input) {
      creatableCount
      blockers {
        operatorId
        operatorName
        date
        reason
      }
      days {
        operatorId
        operatorName
        date
        currentWindows
        lostWindows
        gainedWindows
      }
      conflicts {
        ${IMPACTED_APPOINTMENT_FIELDS}
      }
    }
  }
`;

export const CREATE_SCHEDULE_CHANGE = gql`
  mutation CreateScheduleChange($input: CreateScheduleChangeInput!) {
    createScheduleChange(input: $input) {
      createdCount
      conflictCount
      sourceGroupId
      blockers {
        operatorId
        operatorName
        date
        reason
      }
      exceptions {
        ...AbsenceExceptionFields
      }
    }
  }
  ${ABSENCE_EXCEPTION_FRAGMENT}
`;
