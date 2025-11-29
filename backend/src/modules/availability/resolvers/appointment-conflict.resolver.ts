import { Resolver, Query, Mutation, Args, ID, ObjectType, Field, Int, registerEnumType } from '@nestjs/graphql';
import { AppointmentConflictService, ConflictStats } from '../services/appointment-conflict.service';
import { AvailabilityAppointment, ConflictReason } from '../entities/availability-appointment.entity';
import { GraphQLJSONObject } from 'graphql-type-json';

/**
 * Enum per azioni di risoluzione conflitto
 */
export enum ConflictResolutionAction {
  KEEP = 'keep',
  RESCHEDULE = 'reschedule',
  CANCEL = 'cancel'
}

registerEnumType(ConflictResolutionAction, {
  name: 'ConflictResolutionAction',
  description: 'Action to resolve appointment conflict',
});

/**
 * Output type per statistiche conflitti
 */
@ObjectType()
export class OperatorConflictCount {
  @Field(() => ID)
  operatorId: string;

  @Field()
  operatorName: string;

  @Field(() => Int)
  count: number;
}

@ObjectType()
export class ConflictStatsOutput {
  @Field(() => Int)
  totalConflicts: number;

  @Field(() => GraphQLJSONObject)
  byReason: Record<string, number>;

  @Field(() => [OperatorConflictCount])
  byOperator: OperatorConflictCount[];
}

@Resolver()
export class AppointmentConflictResolver {
  constructor(
    private readonly conflictService: AppointmentConflictService
  ) {}

  // ==================== QUERIES ====================

  /**
   * Lista appuntamenti in conflitto (per dashboard segreteria)
   */
  @Query(() => [AvailabilityAppointment], { name: 'conflictedAppointments' })
  async getConflictedAppointments(
    @Args('operatorId', { type: () => ID, nullable: true }) operatorId?: string,
    @Args('dateFrom', { nullable: true }) dateFrom?: string,
    @Args('dateTo', { nullable: true }) dateTo?: string,
    @Args('conflictReason', { type: () => ConflictReason, nullable: true }) conflictReason?: ConflictReason
  ): Promise<AvailabilityAppointment[]> {
    return this.conflictService.getConflictedAppointments({
      operatorId,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      conflictReason
    });
  }

  /**
   * Statistiche conflitti per dashboard
   */
  @Query(() => ConflictStatsOutput, { name: 'conflictStats' })
  async getConflictStats(): Promise<ConflictStatsOutput> {
    const stats = await this.conflictService.getConflictStats();
    return {
      totalConflicts: stats.totalConflicts,
      byReason: stats.byReason,
      byOperator: stats.byOperator
    };
  }

  /**
   * Conta appuntamenti in conflitto (per badge/notifiche)
   */
  @Query(() => Int, { name: 'conflictedAppointmentsCount' })
  async getConflictedAppointmentsCount(): Promise<number> {
    const stats = await this.conflictService.getConflictStats();
    return stats.totalConflicts;
  }

  // ==================== MUTATIONS ====================

  /**
   * Risolvi un singolo conflitto
   */
  @Mutation(() => AvailabilityAppointment, { name: 'resolveAppointmentConflict' })
  async resolveConflict(
    @Args('appointmentId', { type: () => ID }) appointmentId: string,
    @Args('action', { type: () => ConflictResolutionAction }) action: ConflictResolutionAction,
    @Args('resolvedBy', { type: () => ID }) resolvedBy: string,
    @Args('newDate', { nullable: true }) newDate?: string,
    @Args('newStartTime', { nullable: true }) newStartTime?: string,
    @Args('newEndTime', { nullable: true }) newEndTime?: string,
    @Args('notes', { nullable: true }) notes?: string
  ): Promise<AvailabilityAppointment> {
    const newData = (newDate && newStartTime && newEndTime)
      ? { date: newDate, startTime: newStartTime, endTime: newEndTime }
      : undefined;

    return this.conflictService.resolveConflict(
      appointmentId,
      action as 'keep' | 'reschedule' | 'cancel',
      resolvedBy,
      newData,
      notes
    );
  }

  /**
   * Risolvi multipli conflitti con la stessa azione
   */
  @Mutation(() => [AvailabilityAppointment], { name: 'resolveMultipleConflicts' })
  async resolveMultipleConflicts(
    @Args('appointmentIds', { type: () => [ID] }) appointmentIds: string[],
    @Args('action', { type: () => ConflictResolutionAction }) action: ConflictResolutionAction,
    @Args('resolvedBy', { type: () => ID }) resolvedBy: string,
    @Args('notes', { nullable: true }) notes?: string
  ): Promise<AvailabilityAppointment[]> {
    // Solo keep e cancel supportati per batch (reschedule richiede dati individuali)
    if (action === ConflictResolutionAction.RESCHEDULE) {
      throw new Error('Reschedule non supportato per risoluzione multipla. Usa resolveAppointmentConflict per ogni appuntamento.');
    }

    return this.conflictService.resolveMultipleConflicts(
      appointmentIds,
      action as 'keep' | 'cancel',
      resolvedBy,
      notes
    );
  }
}
