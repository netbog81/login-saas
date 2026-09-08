import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import {
  NotificationChannel,
  NotificationChannelSetting,
} from '../entities/notification-channel-setting.entity';
import { NotificationChannelService } from '../services/notification-channel.service';
import { NotificationChannelSettingInput } from '../dto/notification-channel-setting.input';

@Resolver(() => NotificationChannelSetting)
export class NotificationChannelResolver {
  constructor(private readonly service: NotificationChannelService) {}

  /** Sempre tutti e tre i canali, anche quelli mai configurati. */
  @Query(() => [NotificationChannelSetting], { name: 'notificationChannelSettings' })
  async list(): Promise<NotificationChannelSetting[]> {
    return this.service.list();
  }

  @Mutation(() => NotificationChannelSetting, { name: 'updateNotificationChannelSetting' })
  async update(
    @Args('input') input: NotificationChannelSettingInput,
  ): Promise<NotificationChannelSetting> {
    return this.service.update(input);
  }

  /**
   * Nuovo ordine di tentativo, tutti i canali in una volta.
   *
   * Torna l'elenco completo e non il solo canale spostato: dopo un riordino
   * ogni riga puo' avere una priorita' diversa, e restituirne una sola
   * lascerebbe il client a indovinare le altre due.
   */
  @Mutation(() => [NotificationChannelSetting], { name: 'reorderNotificationChannels' })
  async reorder(
    @Args('order', { type: () => [NotificationChannel] }) order: NotificationChannel[],
  ): Promise<NotificationChannelSetting[]> {
    return this.service.reorder(order);
  }
}
