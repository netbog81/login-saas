/**
 * Notification Channel Service
 * Layer 3: business logic + GraphQL
 *
 * Estende BaseGraphQLService (NgZone): nessuna chiamata Apollo diretta.
 */

import { Injectable, Injector } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BaseGraphQLService } from '../../../core/services/base-graphql.service';
import {
  NotificationChannel, NotificationChannelSetting, NotificationChannelSettingInput,
} from '../models/notification-channel.model';
import {
  GET_NOTIFICATION_CHANNEL_SETTINGS, UPDATE_NOTIFICATION_CHANNEL_SETTING,
  REORDER_NOTIFICATION_CHANNELS,
} from '../graphql/notification-channel.operations';

@Injectable({ providedIn: 'root' })
export class NotificationChannelService extends BaseGraphQLService {
  constructor(injector: Injector) {
    super(injector);
  }

  list(): Observable<NotificationChannelSetting[]> {
    return this.query<{ notificationChannelSettings: NotificationChannelSetting[] }>(
      GET_NOTIFICATION_CHANNEL_SETTINGS,
      {},
      'no-cache',
    ).pipe(map(r => r.notificationChannelSettings));
  }

  update(input: NotificationChannelSettingInput): Observable<NotificationChannelSetting> {
    return this.mutate<{ updateNotificationChannelSetting: NotificationChannelSetting }>(
      UPDATE_NOTIFICATION_CHANNEL_SETTING,
      { input },
    ).pipe(map(r => r.updateNotificationChannelSetting));
  }

  /** Nuovo ordine di tentativo. Torna la lista intera, già riordinata. */
  reorder(order: NotificationChannel[]): Observable<NotificationChannelSetting[]> {
    return this.mutate<{ reorderNotificationChannels: NotificationChannelSetting[] }>(
      REORDER_NOTIFICATION_CHANNELS,
      { order },
    ).pipe(map(r => r.reorderNotificationChannels));
  }
}
