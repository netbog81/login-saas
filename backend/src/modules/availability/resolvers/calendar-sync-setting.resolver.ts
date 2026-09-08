import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthorizationGuard, RequirePermissions } from '../../users/guards/authorization.guard';
import { CalendarSyncSetting } from '../entities/calendar-sync-setting.entity';
import { CalendarSyncSettingService } from '../services/calendar-sync-setting.service';

@Resolver(() => CalendarSyncSetting)
export class CalendarSyncSettingResolver {
  constructor(private readonly service: CalendarSyncSettingService) {}

  /**
   * Leggibile da chiunque sia autenticato: il riquadro in dashboard deve
   * poter spiegare all'operatore cosa succederà al suo calendario se si
   * scollega, e quella spiegazione dipende da queste impostazioni.
   */
  @Query(() => CalendarSyncSetting, { name: 'calendarSyncSettings' })
  async get(): Promise<CalendarSyncSetting> {
    return this.service.get();
  }

  /** Modificabile solo da chi gestisce lo studio: vale per tutti gli operatori. */
  @Mutation(() => CalendarSyncSetting, { name: 'updateCalendarSyncSettings' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('operator_calendar_manage')
  async update(
    @Args('keepPastAppointments', { nullable: true }) keepPastAppointments?: boolean,
    @Args('keepCalendarOnDisconnect', { nullable: true }) keepCalendarOnDisconnect?: boolean,
  ): Promise<CalendarSyncSetting> {
    return this.service.update({ keepPastAppointments, keepCalendarOnDisconnect });
  }
}
