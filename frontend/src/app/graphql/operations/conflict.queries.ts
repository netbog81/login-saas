import { gql } from '@apollo/client/core';

/**
 * Query per ottenere appuntamenti in conflitto
 */
export const GET_CONFLICTED_APPOINTMENTS = gql`
  query GetConflictedAppointments(
    $operatorId: ID
    $dateFrom: String
    $dateTo: String
    $conflictReason: ConflictReason
  ) {
    conflictedAppointments(
      operatorId: $operatorId
      dateFrom: $dateFrom
      dateTo: $dateTo
      conflictReason: $conflictReason
    ) {
      id
      appointmentDate
      startTime
      endTime
      clientName
      clientPhone
      clientEmail
      bookingStatus
      hasConflict
      conflictReason
      conflictDetectedAt
      notes
      operator {
        id
        name
        surname
        color
      }
      service {
        id
        name
        defaultDuration
      }
    }
  }
`;

/**
 * Query per statistiche conflitti
 */
export const GET_CONFLICT_STATS = gql`
  query GetConflictStats {
    conflictStats {
      totalConflicts
      byReason
      byOperator {
        operatorId
        operatorName
        count
      }
    }
  }
`;

/**
 * Query per conteggio conflitti (per badge/notifiche)
 */
export const GET_CONFLICTED_APPOINTMENTS_COUNT = gql`
  query GetConflictedAppointmentsCount {
    conflictedAppointmentsCount
  }
`;

/**
 * Mutation per risolvere un singolo conflitto
 */
export const RESOLVE_APPOINTMENT_CONFLICT = gql`
  mutation ResolveAppointmentConflict(
    $appointmentId: ID!
    $action: ConflictResolutionAction!
    $resolvedBy: ID!
    $newDate: String
    $newStartTime: String
    $newEndTime: String
    $notes: String
  ) {
    resolveAppointmentConflict(
      appointmentId: $appointmentId
      action: $action
      resolvedBy: $resolvedBy
      newDate: $newDate
      newStartTime: $newStartTime
      newEndTime: $newEndTime
      notes: $notes
    ) {
      id
      hasConflict
      conflictReason
      bookingStatus
      appointmentDate
      startTime
      endTime
    }
  }
`;

/**
 * Mutation per risolvere multipli conflitti
 */
export const RESOLVE_MULTIPLE_CONFLICTS = gql`
  mutation ResolveMultipleConflicts(
    $appointmentIds: [ID!]!
    $action: ConflictResolutionAction!
    $resolvedBy: ID!
    $notes: String
  ) {
    resolveMultipleConflicts(
      appointmentIds: $appointmentIds
      action: $action
      resolvedBy: $resolvedBy
      notes: $notes
    ) {
      id
      hasConflict
      bookingStatus
    }
  }
`;

/**
 * Query: revalidazione pigra dei conflitti.
 * Da chiamare al caricamento dell'app (fire-and-forget).
 * Se il cooldown (2h) non è scaduto, ritorna subito skipped=true.
 */
export const REVALIDATE_CONFLICTS_IF_NEEDED = gql`
  query RevalidateConflictsIfNeeded {
    revalidateConflictsIfNeeded {
      skipped
      resolved
    }
  }
`;
