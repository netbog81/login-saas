import { gql } from '@apollo/client/core';

const FEED_FIELDS = `
  operatorId
  enabled
  showPatientName
  showPatientPhone
  feedUrl
  createdAt
  revokedAt
  lastAccessAt
`;

export const GET_OPERATOR_CALENDAR_FEED = gql`
  query OperatorCalendarFeed($operatorId: ID!) {
    operatorCalendarFeed(operatorId: $operatorId) {
      ${FEED_FIELDS}
    }
  }
`;

export const GENERATE_OPERATOR_CALENDAR_FEED = gql`
  mutation GenerateOperatorCalendarFeed($operatorId: ID!) {
    generateOperatorCalendarFeed(operatorId: $operatorId) {
      ${FEED_FIELDS}
    }
  }
`;

export const REVOKE_OPERATOR_CALENDAR_FEED = gql`
  mutation RevokeOperatorCalendarFeed($operatorId: ID!) {
    revokeOperatorCalendarFeed(operatorId: $operatorId) {
      ${FEED_FIELDS}
    }
  }
`;

export const SET_OPERATOR_CALENDAR_FEED_PATIENT_NAME = gql`
  mutation SetOperatorCalendarFeedPatientName($operatorId: ID!, $show: Boolean!) {
    setOperatorCalendarFeedPatientName(operatorId: $operatorId, show: $show) {
      ${FEED_FIELDS}
    }
  }
`;

export const SET_OPERATOR_CALENDAR_FEED_PATIENT_PHONE = gql`
  mutation SetOperatorCalendarFeedPatientPhone($operatorId: ID!, $show: Boolean!) {
    setOperatorCalendarFeedPatientPhone(operatorId: $operatorId, show: $show) {
      ${FEED_FIELDS}
    }
  }
`;

export const SEND_OPERATOR_CALENDAR_FEED_LINK = gql`
  mutation SendOperatorCalendarFeedLink($operatorId: ID!, $channel: String!, $recipient: String!) {
    sendOperatorCalendarFeedLink(operatorId: $operatorId, channel: $channel, recipient: $recipient)
  }
`;
