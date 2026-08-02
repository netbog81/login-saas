import { UseInterceptors } from '@nestjs/common';
import { Resolver, Query, Mutation, Args, ID, Int, Context, InputType } from '@nestjs/graphql';
import { AvailabilityException, ExceptionType } from '../entities/availability-exception.entity';
import { AvailabilityAppointment } from '../entities/availability-appointment.entity';
import { AvailabilityExceptionService } from '../services/availability-exception.service';
import { HolidayService, Holiday } from '../services/holiday.service';
import { ObjectType, Field } from '@nestjs/graphql';
import { AvailabilityChangedInterceptor } from '../mutation-event.interceptors';

@ObjectType()
export class HolidayInfo {
  @Field()
  date: Date;

  @Field()
  name: string;
}

/** Input della creazione batch di assenze operatori/medici. */
@InputType()
export class CreateOperatorAbsencesInput {
  @Field(() => [ID])
  operatorIds: string[];

  @Field()
  dateFrom: string;

  @Field()
  dateTo: string;

  @Field({ nullable: true })
  startTime?: string;

  @Field({ nullable: true })
  endTime?: string;

  @Field(() => ID, { nullable: true })
  absenceTypeId?: string;

  @Field({ nullable: true })
  reason?: string;

  /** Giorni della settimana (0=Lun … 6=Dom). Vuoto = tutti quelli del range. */
  @Field(() => [Int], { nullable: true })
  weekdays?: number[];
}

@ObjectType()
export class OperatorAbsencesResult {
  @Field(() => [AvailabilityException])
  exceptions: AvailabilityException[];

  @Field(() => Int)
  conflictCount: number;

  @Field(() => Int)
  skippedOverlaps: number;

  /** Disponibilità straordinarie rimosse: l'assenza ha la precedenza. */
  @Field(() => Int)
  removedAvailabilityCount: number;

  @Field(() => ID)
  sourceGroupId: string;
}

@ObjectType()
export class AbsenceImpactPreview {
  @Field(() => [AvailabilityAppointment])
  conflicts: AvailabilityAppointment[];

  @Field(() => [AvailabilityAppointment])
  attendedWithoutTreatment: AvailabilityAppointment[];

  /** Disponibilità straordinarie che l'assenza rimuoverebbe. */
  @Field(() => Int)
  removedAvailabilityCount: number;
}

/** Input della creazione batch di disponibilità straordinarie. */
@InputType()
export class CreateOperatorAvailabilityInput {
  @Field(() => [ID])
  operatorIds: string[];

  @Field()
  dateFrom: string;

  @Field()
  dateTo: string;

  /** Obbligatori: una disponibilità senza estremi non ha significato. */
  @Field()
  startTime: string;

  @Field()
  endTime: string;

  @Field({ nullable: true })
  reason?: string;

  /**
   * Giorni della settimana da includere (0=Lun … 6=Dom). Assente/vuoto =
   * tutti i giorni del range. Serve al caso tipico "tutti i mercoledì
   * pomeriggio di settembre".
   */
  @Field(() => [Int], { nullable: true })
  weekdays?: number[];
}

@ObjectType()
export class AvailabilityBlocker {
  @Field(() => ID)
  operatorId: string;

  @Field()
  operatorName: string;

  @Field()
  date: string;

  @Field()
  reason: string;
}

@ObjectType()
export class AvailabilityAlreadyCovered {
  @Field(() => ID)
  operatorId: string;

  @Field()
  operatorName: string;

  @Field()
  date: string;

  @Field(() => [String])
  windows: string[];
}

@ObjectType()
export class AvailabilityImpactPreview {
  @Field(() => Int)
  creatableCount: number;

  @Field(() => [AvailabilityBlocker])
  blockers: AvailabilityBlocker[];

  @Field(() => [AvailabilityAlreadyCovered])
  alreadyCovered: AvailabilityAlreadyCovered[];
}

@ObjectType()
export class ExtraAvailabilityResult {
  @Field(() => [AvailabilityException])
  exceptions: AvailabilityException[];

  @Field(() => Int)
  createdCount: number;

  @Field(() => [AvailabilityBlocker])
  blockers: AvailabilityBlocker[];

  @Field(() => [AvailabilityAlreadyCovered])
  alreadyCovered: AvailabilityAlreadyCovered[];

  @Field(() => ID)
  sourceGroupId: string;
}

/** Una fascia del nuovo orario di giornata. */
@InputType()
export class ScheduleWindowInput {
  @Field()
  startTime: string;

  @Field()
  endTime: string;
}

/**
 * Input del cambio orario. Più finestre = turno spezzato: quel giorno
 * l'operatore fa, ad esempio, 07–15 e 16–20 e nient'altro.
 */
@InputType()
export class CreateScheduleChangeInput {
  @Field(() => [ID])
  operatorIds: string[];

  @Field()
  dateFrom: string;

  @Field()
  dateTo: string;

  @Field(() => [ScheduleWindowInput])
  windows: ScheduleWindowInput[];

  @Field({ nullable: true })
  reason?: string;

  /** Giorni della settimana (0=Lun … 6=Dom). Vuoto = tutti quelli del range. */
  @Field(() => [Int], { nullable: true })
  weekdays?: number[];
}

@ObjectType()
export class ScheduleChangePreviewDay {
  @Field(() => ID)
  operatorId: string;

  @Field()
  operatorName: string;

  @Field()
  date: string;

  /** Orario abituale da template. Vuoto = quel giorno non lavorerebbe. */
  @Field(() => [String])
  currentWindows: string[];

  @Field(() => [String])
  lostWindows: string[];

  @Field(() => [String])
  gainedWindows: string[];
}

@ObjectType()
export class ScheduleChangeImpactPreview {
  @Field(() => Int)
  creatableCount: number;

  @Field(() => [AvailabilityBlocker])
  blockers: AvailabilityBlocker[];

  @Field(() => [ScheduleChangePreviewDay])
  days: ScheduleChangePreviewDay[];

  /** Appuntamenti che finirebbero fuori dal nuovo orario. */
  @Field(() => [AvailabilityAppointment])
  conflicts: AvailabilityAppointment[];
}

@ObjectType()
export class ScheduleChangeResult {
  @Field(() => [AvailabilityException])
  exceptions: AvailabilityException[];

  @Field(() => Int)
  createdCount: number;

  @Field(() => Int)
  conflictCount: number;

  @Field(() => [AvailabilityBlocker])
  blockers: AvailabilityBlocker[];

  @Field(() => ID)
  sourceGroupId: string;
}

@ObjectType()
export class AvailabilityRemovalResult {
  @Field(() => Int)
  deleted: number;

  /** Appuntamenti finiti in conflitto perché rimasti scoperti. */
  @Field(() => Int)
  conflictCount: number;
}

@UseInterceptors(AvailabilityChangedInterceptor)
@Resolver(() => AvailabilityException)
export class AvailabilityExceptionResolver {
  constructor(
    private readonly exceptionService: AvailabilityExceptionService,
    private readonly holidayService: HolidayService,
  ) {}

  // Queries
  @Query(() => [AvailabilityException], { name: 'availabilityExceptions' })
  async getExceptions(
    @Args('operatorId', { type: () => ID, nullable: true }) operatorId?: string,
    @Args('exceptionType', { type: () => ExceptionType, nullable: true }) exceptionType?: ExceptionType,
    @Args('startDate', { nullable: true }) startDateStr?: string,
    @Args('endDate', { nullable: true }) endDateStr?: string,
  ): Promise<AvailabilityException[]> {
    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;
    return this.exceptionService.findAll(operatorId, exceptionType, startDate, endDate);
  }

  @Query(() => AvailabilityException, { name: 'availabilityException', nullable: true })
  async getException(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<AvailabilityException> {
    return this.exceptionService.findOne(id);
  }

  @Query(() => [AvailabilityException], { name: 'operatorExceptions' })
  async getOperatorExceptions(
    @Args('operatorId', { type: () => ID }) operatorId: string,
    @Args('startDate', { nullable: true }) startDateStr?: string,
    @Args('endDate', { nullable: true }) endDateStr?: string,
  ): Promise<AvailabilityException[]> {
    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;
    return this.exceptionService.findByOperator(operatorId, startDate, endDate);
  }

  @Query(() => [HolidayInfo], { name: 'holidays' })
  async getHolidays(
    @Args('year', { type: () => Int }) year: number,
  ): Promise<HolidayInfo[]> {
    const holidays = this.holidayService.getHolidaysForYear(year);
    return holidays.map(h => ({ date: h.date, name: h.name }));
  }

  @Query(() => Boolean, { name: 'isHoliday' })
  async checkIsHoliday(
    @Args('date') dateStr: string,
  ): Promise<boolean> {
    const date = new Date(dateStr);
    return this.holidayService.isHoliday(date) !== null;
  }

  /**
   * Anteprima (dry-run) degli appuntamenti impattati da un'assenza,
   * mostrata nel dialog PRIMA del salvataggio.
   */
  @Query(() => AbsenceImpactPreview, { name: 'previewOperatorAbsenceImpact' })
  async previewOperatorAbsenceImpact(
    @Args('operatorIds', { type: () => [ID] }) operatorIds: string[],
    @Args('dateFrom') dateFrom: string,
    @Args('dateTo') dateTo: string,
    @Args('startTime', { nullable: true }) startTime?: string,
    @Args('endTime', { nullable: true }) endTime?: string,
  ): Promise<AbsenceImpactPreview> {
    return this.exceptionService.previewAbsenceImpact({
      operatorIds,
      dateFrom,
      dateTo,
      startTime,
      endTime,
    });
  }

  /**
   * Crea le assenze per più operatori su un range di giorni, marcando i
   * conflitti sugli appuntamenti impattati.
   */
  @Mutation(() => OperatorAbsencesResult, { name: 'createOperatorAbsences' })
  async createOperatorAbsences(
    @Args('input') input: CreateOperatorAbsencesInput,
    @Context() context: any,
  ): Promise<OperatorAbsencesResult> {
    const userId = context?.req?.user?.id || context?.req?.tenantContext?.userId;
    return this.exceptionService.createOperatorAbsences({
      operatorIds: input.operatorIds,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      startTime: input.startTime,
      endTime: input.endTime,
      absenceTypeId: input.absenceTypeId,
      reason: input.reason,
      weekdays: input.weekdays,
      performedBy: userId,
    });
  }

  // ============ DISPONIBILITÀ STRAORDINARIE ============

  /**
   * Anteprima (dry-run) dell'inserimento: quanti giorni si creerebbero,
   * quali no e perché, quali fasce erano già coperte dal template.
   */
  @Query(() => AvailabilityImpactPreview, { name: 'previewOperatorAvailabilityImpact' })
  async previewOperatorAvailabilityImpact(
    @Args('input') input: CreateOperatorAvailabilityInput,
  ): Promise<AvailabilityImpactPreview> {
    return this.exceptionService.previewAvailabilityImpact(input);
  }

  /**
   * Anteprima della rimozione: appuntamenti che resterebbero scoperti
   * togliendo la disponibilità straordinaria indicata.
   */
  @Query(() => [AvailabilityAppointment], { name: 'previewAvailabilityRemovalImpact' })
  async previewAvailabilityRemovalImpact(
    @Args('exceptionIds', { type: () => [ID] }) exceptionIds: string[],
  ): Promise<AvailabilityAppointment[]> {
    return this.exceptionService.previewAvailabilityRemovalImpact(exceptionIds);
  }

  /**
   * Come sopra, ma per un intero gruppo creato in blocco — di qualunque
   * tipo: assenze, disponibilità o cambi orario.
   */
  @Query(() => [AvailabilityAppointment], { name: 'previewGroupRemovalImpact' })
  async previewGroupRemovalImpact(
    @Args('sourceGroupId', { type: () => ID }) sourceGroupId: string,
  ): Promise<AvailabilityAppointment[]> {
    return this.exceptionService.previewGroupRemovalImpact(sourceGroupId);
  }

  // ============ CAMBIO ORARIO ============

  /**
   * Anteprima del cambio orario: confronto orario abituale / nuovo per
   * giorno, giorni scartati e appuntamenti che finirebbero fuori.
   */
  @Query(() => ScheduleChangeImpactPreview, { name: 'previewScheduleChangeImpact' })
  async previewScheduleChangeImpact(
    @Args('input') input: CreateScheduleChangeInput,
  ): Promise<ScheduleChangeImpactPreview> {
    return this.exceptionService.previewScheduleChangeImpact(input);
  }

  /**
   * Applica il cambio orario: il nuovo orario SOSTITUISCE quello da template
   * per i giorni indicati. Più fasce = turno spezzato.
   */
  @Mutation(() => ScheduleChangeResult, { name: 'createScheduleChange' })
  async createScheduleChange(
    @Args('input') input: CreateScheduleChangeInput,
    @Context() context: any,
  ): Promise<ScheduleChangeResult> {
    const userId = context?.req?.user?.id || context?.req?.tenantContext?.userId;
    return this.exceptionService.createScheduleChange({
      ...input,
      performedBy: userId,
    });
  }

  /**
   * Crea le disponibilità straordinarie per più operatori su un range di
   * giorni. I giorni non validi vengono saltati e riportati in `blockers`.
   */
  @Mutation(() => ExtraAvailabilityResult, { name: 'createOperatorAvailability' })
  async createOperatorAvailability(
    @Args('input') input: CreateOperatorAvailabilityInput,
    @Context() context: any,
  ): Promise<ExtraAvailabilityResult> {
    const userId = context?.req?.user?.id || context?.req?.tenantContext?.userId;
    return this.exceptionService.createOperatorAvailability({
      ...input,
      performedBy: userId,
    });
  }

  /**
   * Cancella un intero gruppo creato in blocco, di qualunque tipo. I
   * conflitti generati dal gruppo vengono ripristinati e gli appuntamenti
   * che restano scoperti vengono segnalati — il dispatch è nel service.
   */
  @Mutation(() => AvailabilityRemovalResult, { name: 'deleteExceptionGroup' })
  async deleteExceptionGroup(
    @Args('sourceGroupId', { type: () => ID }) sourceGroupId: string,
    @Context() context: any,
  ): Promise<AvailabilityRemovalResult> {
    const userId = context?.req?.user?.id || context?.req?.tenantContext?.userId;
    return this.exceptionService.deleteExceptionGroup(sourceGroupId, userId);
  }

  /** Cancella tutte le eccezioni di un gruppo (range dal…al / multi-operatore). */
  @Mutation(() => Int, { name: 'deleteAbsenceGroup' })
  async deleteAbsenceGroup(
    @Args('sourceGroupId', { type: () => ID }) sourceGroupId: string,
  ): Promise<number> {
    return this.exceptionService.deleteAbsenceGroup(sourceGroupId);
  }

  // Mutations
  @Mutation(() => AvailabilityException, { name: 'createException' })
  async createException(
    @Args('operatorId', { type: () => ID }) operatorId: string,
    @Args('exceptionDate') exceptionDateStr: string,
    @Args('exceptionType', { type: () => ExceptionType }) exceptionType: ExceptionType,
    @Args('startTime', { nullable: true }) startTime?: string,
    @Args('endTime', { nullable: true }) endTime?: string,
    @Args('reason', { nullable: true }) reason?: string,
  ): Promise<AvailabilityException> {
    return this.exceptionService.create({
      operatorId,
      exceptionDate: new Date(exceptionDateStr),
      exceptionType,
      startTime,
      endTime,
      reason,
    });
  }

  @Mutation(() => [AvailabilityException], { name: 'createVacation' })
  async createVacation(
    @Args('operatorId', { type: () => ID }) operatorId: string,
    @Args('startDate') startDateStr: string,
    @Args('endDate') endDateStr: string,
    @Args('reason', { nullable: true }) reason?: string,
  ): Promise<AvailabilityException[]> {
    return this.exceptionService.createVacation(
      operatorId,
      new Date(startDateStr),
      new Date(endDateStr),
      reason,
    );
  }

  @Mutation(() => [AvailabilityException], { name: 'createSickLeave' })
  async createSickLeave(
    @Args('operatorId', { type: () => ID }) operatorId: string,
    @Args('startDate') startDateStr: string,
    @Args('endDate') endDateStr: string,
    @Args('reason', { nullable: true }) reason?: string,
  ): Promise<AvailabilityException[]> {
    return this.exceptionService.createSickLeave(
      operatorId,
      new Date(startDateStr),
      new Date(endDateStr),
      reason,
    );
  }

  @Mutation(() => AvailabilityException, { name: 'updateException' })
  async updateException(
    @Args('id', { type: () => ID }) id: string,
    @Args('exceptionType', { type: () => ExceptionType, nullable: true }) exceptionType?: ExceptionType,
    @Args('startTime', { nullable: true }) startTime?: string,
    @Args('endTime', { nullable: true }) endTime?: string,
    @Args('reason', { nullable: true }) reason?: string,
  ): Promise<AvailabilityException> {
    return this.exceptionService.update(id, {
      exceptionType,
      startTime,
      endTime,
      reason,
    });
  }

  /**
   * Cancella una singola eccezione. L'effetto sui conflitti dipende dal tipo:
   * un'assenza li RIPRISTINA, una disponibilità straordinaria li CREA sugli
   * appuntamenti rimasti scoperti (vedi AvailabilityExceptionService.delete).
   */
  @Mutation(() => Boolean, { name: 'deleteException' })
  async deleteException(
    @Args('id', { type: () => ID }) id: string,
    @Context() context: any,
  ): Promise<boolean> {
    const userId = context?.req?.user?.id || context?.req?.tenantContext?.userId;
    return this.exceptionService.delete(id, userId);
  }

  @Mutation(() => Int, { name: 'deleteExceptionsByDateRange' })
  async deleteExceptionsByDateRange(
    @Args('operatorId', { type: () => ID }) operatorId: string,
    @Args('startDate') startDateStr: string,
    @Args('endDate') endDateStr: string,
    @Args('exceptionType', { type: () => ExceptionType, nullable: true }) exceptionType?: ExceptionType,
  ): Promise<number> {
    return this.exceptionService.deleteByDateRange(
      operatorId,
      new Date(startDateStr),
      new Date(endDateStr),
      exceptionType,
    );
  }

  @Mutation(() => Int, { name: 'generateHolidaysForYear' })
  async generateHolidaysForYear(
    @Args('year', { type: () => Int }) year: number,
  ): Promise<number> {
    return this.holidayService.generateHolidaysForYear(year);
  }

  @Mutation(() => Int, { name: 'generateHolidaysForOperator' })
  async generateHolidaysForOperator(
    @Args('operatorId', { type: () => ID }) operatorId: string,
    @Args('year', { type: () => Int }) year: number,
  ): Promise<number> {
    return this.holidayService.generateHolidaysForOperator(operatorId, year);
  }

  @Mutation(() => Int, { name: 'deleteHolidaysForYear' })
  async deleteHolidaysForYear(
    @Args('year', { type: () => Int }) year: number,
  ): Promise<number> {
    return this.holidayService.deleteHolidaysForYear(year);
  }
}
