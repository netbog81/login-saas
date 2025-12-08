import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { AvailabilityAppointment } from '../entities/availability-appointment.entity';
import { AvailabilityAppointmentService } from '../services/availability-appointment.service';
import { CreateAvailabilityAppointmentInput } from '../dto/create-availability-appointment.input';
import { UpdateAvailabilityAppointmentInput } from '../dto/update-availability-appointment.input';
import { CreateGymAppointmentInput } from '../dto/create-gym-appointment.input';
import { GymSlotInfo } from '../dto/gym-slot-info.type';
import { GymAvailabilityService } from '../services/gym-availability.service';

@Resolver(() => AvailabilityAppointment)
export class AvailabilityAppointmentResolver {
  constructor(
    private readonly appointmentService: AvailabilityAppointmentService,
    private readonly gymAvailabilityService: GymAvailabilityService,
  ) {}

  /**
   * Query: Ottiene un singolo appuntamento per ID
   */
  @Query(() => AvailabilityAppointment, { name: 'availabilityAppointment', nullable: true })
  async getAppointment(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<AvailabilityAppointment> {
    return this.appointmentService.findById(id);
  }

  /**
   * Query: Ottiene appuntamenti per operatore e range di date
   */
  @Query(() => [AvailabilityAppointment], { name: 'availabilityAppointmentsByOperator' })
  async getAppointmentsByOperator(
    @Args('operatorId', { type: () => ID }) operatorId: string,
    @Args('startDate') startDate: string,
    @Args('endDate') endDate: string,
  ): Promise<AvailabilityAppointment[]> {
    return this.appointmentService.findByOperatorAndDateRange(operatorId, startDate, endDate);
  }

  /**
   * Query: Ottiene appuntamenti per range di date (tutti gli operatori o specifici)
   */
  @Query(() => [AvailabilityAppointment], { name: 'availabilityAppointments' })
  async getAppointments(
    @Args('startDate') startDate: string,
    @Args('endDate') endDate: string,
    @Args('operatorIds', { type: () => [ID], nullable: true }) operatorIds?: string[],
  ): Promise<AvailabilityAppointment[]> {
    return this.appointmentService.findByDateRange(startDate, endDate, operatorIds);
  }

  /**
   * Mutation: Crea un nuovo appuntamento
   */
  @Mutation(() => AvailabilityAppointment, { name: 'createAvailabilityAppointment' })
  async createAppointment(
    @Args('input') input: CreateAvailabilityAppointmentInput,
  ): Promise<AvailabilityAppointment> {
    return this.appointmentService.create(input);
  }

  /**
   * Mutation: Aggiorna un appuntamento esistente
   */
  @Mutation(() => AvailabilityAppointment, { name: 'updateAvailabilityAppointment' })
  async updateAppointment(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateAvailabilityAppointmentInput,
  ): Promise<AvailabilityAppointment> {
    return this.appointmentService.update(id, input);
  }

  /**
   * Mutation: Cancella un appuntamento (soft delete)
   */
  @Mutation(() => AvailabilityAppointment, { name: 'cancelAvailabilityAppointment' })
  async cancelAppointment(
    @Args('id', { type: () => ID }) id: string,
    @Args('cancellationReason', { nullable: true }) cancellationReason?: string,
  ): Promise<AvailabilityAppointment> {
    return this.appointmentService.cancel(id, cancellationReason);
  }

  /**
   * Mutation: Elimina definitivamente un appuntamento
   */
  @Mutation(() => Boolean, { name: 'deleteAvailabilityAppointment' })
  async deleteAppointment(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.appointmentService.delete(id);
  }

  /**
   * Mutation: Conferma un appuntamento
   */
  @Mutation(() => AvailabilityAppointment, { name: 'confirmAvailabilityAppointment' })
  async confirmAppointment(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<AvailabilityAppointment> {
    return this.appointmentService.confirm(id);
  }

  /**
   * Mutation: Segna come no-show
   */
  @Mutation(() => AvailabilityAppointment, { name: 'markAppointmentAsNoShow' })
  async markAsNoShow(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<AvailabilityAppointment> {
    return this.appointmentService.markAsNoShow(id);
  }

  /**
   * Query: Verifica se uno strumento è disponibile per un dato slot
   */
  @Query(() => Boolean, { name: 'isInstrumentAvailable' })
  async isInstrumentAvailable(
    @Args('instrumentId', { type: () => ID }) instrumentId: string,
    @Args('appointmentDate') appointmentDate: string,
    @Args('startTime') startTime: string,
    @Args('startOffsetMinutes') startOffsetMinutes: number,
    @Args('endOffsetMinutes') endOffsetMinutes: number,
    @Args('excludeAppointmentId', { type: () => ID, nullable: true }) excludeAppointmentId?: string,
  ): Promise<boolean> {
    return this.appointmentService.isInstrumentAvailable(
      instrumentId,
      appointmentDate,
      startTime,
      startOffsetMinutes,
      endOffsetMinutes,
      excludeAppointmentId,
    );
  }

  // ==========================================
  // QUERY E MUTATION PER APPUNTAMENTI PALESTRA
  // ==========================================

  /**
   * Query: Ottiene appuntamenti per una GymRoom in una data specifica
   */
  @Query(() => [AvailabilityAppointment], { name: 'gymRoomAppointments' })
  async getGymRoomAppointments(
    @Args('gymRoomId', { type: () => ID }) gymRoomId: string,
    @Args('date') date: string,
  ): Promise<AvailabilityAppointment[]> {
    return this.appointmentService.findByGymRoomAndDate(gymRoomId, date);
  }

  /**
   * Query: Ottiene appuntamenti per più GymRoom in un range di date
   */
  @Query(() => [AvailabilityAppointment], { name: 'gymRoomsAppointments' })
  async getGymRoomsAppointments(
    @Args('gymRoomIds', { type: () => [ID] }) gymRoomIds: string[],
    @Args('startDate') startDate: string,
    @Args('endDate') endDate: string,
  ): Promise<AvailabilityAppointment[]> {
    return this.appointmentService.findByGymRoomsAndDateRange(gymRoomIds, startDate, endDate);
  }

  /**
   * Query: Ottiene gli slot disponibili per una GymRoom in una data
   * Ritorna informazioni su capacità e disponibilità per ogni slot
   */
  @Query(() => [GymSlotInfo], { name: 'gymRoomAvailableSlots' })
  async getGymRoomAvailableSlots(
    @Args('gymRoomId', { type: () => ID }) gymRoomId: string,
    @Args('date') date: string,
  ): Promise<GymSlotInfo[]> {
    return this.gymAvailabilityService.getAvailableSlotsWithCapacity(gymRoomId, date);
  }

  /**
   * Mutation: Crea un appuntamento palestra con validazione capacità
   */
  @Mutation(() => AvailabilityAppointment, { name: 'createGymAppointment' })
  async createGymAppointment(
    @Args('input') input: CreateGymAppointmentInput,
  ): Promise<AvailabilityAppointment> {
    return this.appointmentService.createGymAppointment(input);
  }
}
