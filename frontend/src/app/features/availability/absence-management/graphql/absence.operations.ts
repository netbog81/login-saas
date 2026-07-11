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
