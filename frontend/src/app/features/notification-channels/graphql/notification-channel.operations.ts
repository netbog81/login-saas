import { gql } from 'apollo-angular';

const FIELDS = gql`
  fragment NotificationChannelSettingFields on NotificationChannelSetting {
    id
    channel
    enabled
    categories
    priority
    smsDriver
    emailFromName
  }
`;

export const GET_NOTIFICATION_CHANNEL_SETTINGS = gql`
  ${FIELDS}
  query NotificationChannelSettings {
    notificationChannelSettings { ...NotificationChannelSettingFields }
  }
`;

export const UPDATE_NOTIFICATION_CHANNEL_SETTING = gql`
  ${FIELDS}
  mutation UpdateNotificationChannelSetting($input: NotificationChannelSettingInput!) {
    updateNotificationChannelSetting(input: $input) { ...NotificationChannelSettingFields }
  }
`;

/**
 * Riordino: si mandano tutti e tre i canali, si riceve tutta la lista.
 * Il backend riscrive le priorità in transazione — un ordine applicato a
 * metà lascerebbe due canali alla stessa priorità.
 */
export const REORDER_NOTIFICATION_CHANNELS = gql`
  ${FIELDS}
  mutation ReorderNotificationChannels($order: [NotificationChannel!]!) {
    reorderNotificationChannels(order: $order) { ...NotificationChannelSettingFields }
  }
`;
