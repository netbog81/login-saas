import { gql } from '@apollo/client/core';

const STATUS_FIELDS = `
  operatorId
  canConnect
  connected
  declaredEmail
  googleEmail
  calendarName
  suggestedCalendarName
  status
  connectedAt
  lastSyncAt
  lastErrorMessage
  needsReconnect
  testingMode
  expiresAt
  daysLeft
  expiringSoon
  alertWhatsapp
  alertEmail
  operatorPhone
  operatorEmail
`;

export const GET_OPERATOR_GOOGLE_CALENDAR = gql`
  query OperatorGoogleCalendar($operatorId: ID!) {
    operatorGoogleCalendar(operatorId: $operatorId) {
      ${STATUS_FIELDS}
    }
  }
`;

export const START_GOOGLE_CALENDAR_CONNECT = gql`
  mutation StartOperatorGoogleCalendarConnect($operatorId: ID!, $calendarName: String) {
    startOperatorGoogleCalendarConnect(operatorId: $operatorId, calendarName: $calendarName)
  }
`;

export const DISCONNECT_GOOGLE_CALENDAR = gql`
  mutation DisconnectOperatorGoogleCalendar($operatorId: ID!) {
    disconnectOperatorGoogleCalendar(operatorId: $operatorId) {
      ${STATUS_FIELDS}
    }
  }
`;

export const SET_OPERATOR_GOOGLE_EMAIL = gql`
  mutation SetOperatorGoogleAccountEmail($operatorId: ID!, $email: String) {
    setOperatorGoogleAccountEmail(operatorId: $operatorId, email: $email) {
      ${STATUS_FIELDS}
    }
  }
`;

export const RENAME_GOOGLE_CALENDAR = gql`
  mutation RenameOperatorGoogleCalendar($operatorId: ID!, $calendarName: String!) {
    renameOperatorGoogleCalendar(operatorId: $operatorId, calendarName: $calendarName) {
      ${STATUS_FIELDS}
    }
  }
`;

export const SYNC_GOOGLE_CALENDAR = gql`
  mutation SyncOperatorGoogleCalendar($operatorId: ID!) {
    syncOperatorGoogleCalendar(operatorId: $operatorId) {
      ${STATUS_FIELDS}
    }
  }
`;

export const SET_OPERATOR_GOOGLE_ALERT_CHANNEL = gql`
  mutation SetOperatorGoogleAlertChannel(
    $operatorId: ID!, $channel: String!, $enabled: Boolean!
  ) {
    setOperatorGoogleAlertChannel(
      operatorId: $operatorId, channel: $channel, enabled: $enabled
    ) {
      ${STATUS_FIELDS}
    }
  }
`;

export const SEND_OPERATOR_GOOGLE_RENEW_LINK = gql`
  mutation SendOperatorGoogleRenewLink(
    $operatorId: ID!, $channel: String!, $recipient: String!
  ) {
    sendOperatorGoogleRenewLink(
      operatorId: $operatorId, channel: $channel, recipient: $recipient
    )
  }
`;

/**
 * Il PROPRIO collegamento: la persona si ricava dal token.
 *
 * Query distinta da quella per operatorId perche' quella richiede
 * `operator_calendar_manage`, che hanno chi amministra e la segreteria —
 * chiedendola dalla dashboard, un operatore riceveva un errore e non vedeva
 * niente.
 */
export const GET_MY_GOOGLE_CALENDAR = gql`
  query MyGoogleCalendar {
    myGoogleCalendar {
      ${STATUS_FIELDS}
    }
  }
`;

export const START_MY_GOOGLE_CALENDAR_CONNECT = gql`
  mutation StartMyGoogleCalendarConnect {
    startMyGoogleCalendarConnect
  }
`;

export const SET_MY_GOOGLE_ALERT_CHANNEL = gql`
  mutation SetMyGoogleAlertChannel($channel: String!, $enabled: Boolean!) {
    setMyGoogleAlertChannel(channel: $channel, enabled: $enabled) {
      ${STATUS_FIELDS}
    }
  }
`;

export const SEND_MY_GOOGLE_RENEW_LINK = gql`
  mutation SendMyGoogleRenewLink($channel: String!) {
    sendMyGoogleRenewLink(channel: $channel)
  }
`;

export const DISCONNECT_MY_GOOGLE_CALENDAR = gql`
  mutation DisconnectMyGoogleCalendar {
    disconnectMyGoogleCalendar {
      ${STATUS_FIELDS}
    }
  }
`;

export const GET_CALENDAR_SYNC_SETTINGS = gql`
  query CalendarSyncSettings {
    calendarSyncSettings {
      id
      keepPastAppointments
      keepCalendarOnDisconnect
    }
  }
`;

export const UPDATE_CALENDAR_SYNC_SETTINGS = gql`
  mutation UpdateCalendarSyncSettings(
    $keepPastAppointments: Boolean, $keepCalendarOnDisconnect: Boolean
  ) {
    updateCalendarSyncSettings(
      keepPastAppointments: $keepPastAppointments
      keepCalendarOnDisconnect: $keepCalendarOnDisconnect
    ) {
      id
      keepPastAppointments
      keepCalendarOnDisconnect
    }
  }
`;

export const GET_OPERATORS_SYNC_SUMMARY = gql`
  query OperatorsSyncSummary {
    operatorsSyncSummary {
      operatorId
      feedEnabled
      googleConnected
      googleEmail
      declaredEmail
      googleNeedsReconnect
      googleDaysLeft
    }
  }
`;
