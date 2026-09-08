import { gql } from '@apollo/client/core';

const STATUS_FIELDS = `
  patientId
  exists
  active
  emailSentAt
  emailSentTo
  subscribedAt
  lastAccessAt
  revokedAt
  revokedBy
`;

export const GET_PATIENT_CALENDAR_FEED = gql`
  query PatientCalendarFeed($patientId: ID!) {
    patientCalendarFeed(patientId: $patientId) {
      ${STATUS_FIELDS}
    }
  }
`;

export const GET_PATIENT_CALENDAR_FEEDS = gql`
  query PatientCalendarFeeds {
    patientCalendarFeeds {
      ${STATUS_FIELDS}
      patientName
      createdAt
    }
  }
`;

export const SEND_PATIENT_CALENDAR_FEED_LINK = gql`
  mutation SendPatientCalendarFeedLink($patientId: ID!, $email: String) {
    sendPatientCalendarFeedLink(patientId: $patientId, email: $email)
  }
`;

export const REVOKE_PATIENT_CALENDAR_FEED = gql`
  mutation RevokePatientCalendarFeed($patientId: ID!) {
    revokePatientCalendarFeed(patientId: $patientId)
  }
`;

export const REVOKE_ALL_PATIENT_CALENDAR_FEEDS = gql`
  mutation RevokeAllPatientCalendarFeeds {
    revokeAllPatientCalendarFeeds
  }
`;

export const REVOKE_STALE_PATIENT_CALENDAR_FEEDS = gql`
  mutation RevokeStalePatientCalendarFeeds {
    revokeStalePatientCalendarFeeds
  }
`;
