import { Resolver, Query, Mutation, Args, ID, Int, ResolveField, Parent } from '@nestjs/graphql';
import { AvailabilityAppointment } from '../entities/availability-appointment.entity';
import { AppointmentService as AppointmentServiceEntity } from '../entities/appointment-service.entity';
import { AvailabilityAppointmentService } from '../services/availability-appointment.service';
import { CreateAvailabilityAppointmentInput } from '../dto/create-availability-appointment.input';
import { UpdateAvailabilityAppointmentInput } from '../dto/update-availability-appointment.input';
import { CreateGymAppointmentInput } from '../dto/create-gym-appointment.input';
import { GymSlotInfo, GymSlotInfoWithContext } from '../dto/gym-slot-info.type';
import { GymAvailabilityService } from '../services/gym-availability.service';
import { RecurringSeriesScope, UpdateRecurringSeriesTimeInput } from '../dto/recurring-series.input';
import { RecurringSeriesOperationResult } from '../dto/recurring-series-conflict.output';
import { TenantContextService } from '@curandis/tenant-datasource';

@Resolver(() => AvailabilityAppointment)
export class AvailabilityAppointmentResolver {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly appointmentService: AvailabilityAppointmentService,
    private readonly gymAvailabilityService: GymAvailabilityService,
  ){}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get appointmentServiceRepo() { return this.dataSource.getRepository(AppointmentServiceEntity); }

  /**
   * ResolveField: Risolve appointmentServices per un appuntamento
   * Caricamento separato per evitare dipendenze circolari TypeORM
   */
  @ResolveField(() => [AppointmentServiceEntity], { nullable: true })
  async appointmentServices(
    @Parent() appointment: AvailabilityAppointment,
  ): Promise<AppointmentServiceEntity[]> {
    return this.appointmentServiceRepo.find({
      where: { appointmentId: appointment.id },
      relations: ['service'],
      order: { orderPosition: 'ASC' },
    });
  }

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
   * Mutation: Segna come no-show (legacy - mantiene compatibilità)
   */
  @Mutation(() => AvailabilityAppointment, { name: 'markAppointmentAsNoShow' })
  async markAsNoShow(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<AvailabilityAppointment> {
    return this.appointmentService.markAsNoShow(id);
  }

  // ==================== NUOVE MUTATIONS PER GESTIONE STATI ====================

  /**
   * Mutation: Cancella un appuntamento con calcolo automatico del preavviso
   * Se preavviso >24h → CANCELLED_EARLY (no penalità)
   * Se preavviso <24h → CANCELLED_LATE (incrementa contatore paziente)
   */
  @Mutation(() => AvailabilityAppointment, { name: 'cancelAppointmentWithNotice' })
  async cancelAppointmentWithNotice(
    @Args('id', { type: () => ID }) id: string,
    @Args('reason') reason: string,
    @Args('cancelledBy', { type: () => ID }) cancelledBy: string,
  ): Promise<AvailabilityAppointment> {
    return this.appointmentService.cancelAppointment(id, reason, cancelledBy);
  }

  /**
   * Mutation: Segna appuntamento come no-show (incrementa contatore paziente)
   */
  @Mutation(() => AvailabilityAppointment, { name: 'markAppointmentNoShow' })
  async markNoShow(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<AvailabilityAppointment> {
    return this.appointmentService.markNoShow(id);
  }

  /**
   * Mutation: Segna appuntamento come attended (paziente presentato)
   * Abilita la creazione di un trattamento
   */
  @Mutation(() => AvailabilityAppointment, { name: 'markAppointmentAttended' })
  async markAttended(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<AvailabilityAppointment> {
    return this.appointmentService.markAttended(id);
  }

  /**
   * Mutation: Annulla stato attended e ripristina a confirmed
   * Utile per correggere click accidentali
   */
  @Mutation(() => AvailabilityAppointment, { name: 'revertAppointmentAttended' })
  async revertAttended(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<AvailabilityAppointment> {
    return this.appointmentService.revertAttended(id);
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
   * Query batch: Ottiene gli slot disponibili per più gym room in un range di date.
   */
  @Query(() => [GymSlotInfoWithContext], { name: 'gymRoomsAvailableSlots' })
  async getGymRoomsAvailableSlots(
    @Args('gymRoomIds', { type: () => [ID] }) gymRoomIds: string[],
    @Args('startDate') startDate: string,
    @Args('endDate') endDate: string,
  ): Promise<GymSlotInfoWithContext[]> {
    return this.gymAvailabilityService.getAvailableSlotsForRooms(gymRoomIds, startDate, endDate) as any;
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

  // ==========================================
  // QUERY E MUTATION PER APPUNTAMENTI PAZIENTE
  // ==========================================

  /**
   * Query: Ottiene appuntamenti futuri di un paziente a partire da una data
   */
  @Query(() => [AvailabilityAppointment], { name: 'availabilityAppointmentsByPatient' })
  async getAppointmentsByPatient(
    @Args('patientId', { type: () => ID }) patientId: string,
    @Args('startDate') startDate: string,
  ): Promise<AvailabilityAppointment[]> {
    return this.appointmentService.findByPatientFromDate(patientId, startDate);
  }

  /**
   * Mutation: Re-invia il messaggio WhatsApp di recap per un appuntamento
   */
  @Mutation(() => Boolean, { name: 'sendAppointmentRecap' })
  async sendAppointmentRecap(
    @Args('appointmentId', { type: () => ID }) appointmentId: string,
  ): Promise<boolean> {
    return this.appointmentService.sendRecap(appointmentId);
  }

  // ==================== RECURRING SERIES ====================

  /**
   * Query: Ottiene tutti gli appuntamenti di una serie ricorrente
   */
  @Query(() => [AvailabilityAppointment], { name: 'recurringSeries' })
  async getRecurringSeries(
    @Args('recurringGroupId', { type: () => ID }) recurringGroupId: string,
  ): Promise<AvailabilityAppointment[]> {
    return this.appointmentService.getRecurringSeries(recurringGroupId);
  }

  /**
   * Mutation: Cancella (soft) appuntamenti di una serie ricorrente
   */
  @Mutation(() => Int, { name: 'cancelRecurringSeries' })
  async cancelRecurringSeries(
    @Args('appointmentId', { type: () => ID }) appointmentId: string,
    @Args('fromDate') fromDate: string,
    @Args('scope', { type: () => RecurringSeriesScope }) scope: RecurringSeriesScope,
    @Args('reason') reason: string,
    @Args('cancelledBy', { type: () => ID }) cancelledBy: string,
  ): Promise<number> {
    return this.appointmentService.cancelRecurringSeries(
      appointmentId, fromDate, reason, cancelledBy, scope,
    );
  }

  /**
   * Mutation: Elimina (hard delete) appuntamenti di una serie ricorrente.
   * Scope: solo corrente / corrente+successivi / intera serie / intervallo date.
   */
  @Mutation(() => Int, { name: 'deleteRecurringSeries' })
  async deleteRecurringSeries(
    @Args('appointmentId', { type: () => ID }) appointmentId: string,
    @Args('fromDate') fromDate: string,
    @Args('scope', { type: () => RecurringSeriesScope }) scope: RecurringSeriesScope,
    @Args('rangeFrom', { nullable: true }) rangeFrom?: string,
    @Args('rangeTo', { nullable: true }) rangeTo?: string,
    @Args('includeCurrent', { nullable: true }) includeCurrent?: boolean,
  ): Promise<number> {
    return this.appointmentService.deleteRecurringSeries(
      appointmentId, fromDate, scope, rangeFrom, rangeTo, includeCurrent,
    );
  }

  /**
   * Mutation: Modifica orario/durata delle occorrenze di una serie ricorrente
   * nello scope scelto. Valida prima ogni occorrenza: se ci sono conflitti
   * (fuori disponibilità o sovrapposizioni) NON applica nulla e li ritorna.
   */
  @Mutation(() => RecurringSeriesOperationResult, { name: 'updateRecurringSeriesTime' })
  async updateRecurringSeriesTime(
    @Args('input') input: UpdateRecurringSeriesTimeInput,
  ): Promise<RecurringSeriesOperationResult> {
    return this.appointmentService.updateRecurringSeriesTime(input);
  }
}
