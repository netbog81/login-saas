import { UseInterceptors } from '@nestjs/common';
import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { TemplateAssignment } from '../entities/template-assignment.entity';
import { TemplateAssignmentService } from '../services/template-assignment.service';
import { AvailabilityService } from '../services/availability.service';
import { RoomConflictService } from '../services/room-conflict.service';
import {
  AssignTemplateToOperatorInput,
  AssignmentRoomOverrideInput,
} from '../dto/assign-template-to-operator.input';
import { RoomConflictCheckResult } from '../dto/room-conflict-check.output';
import { RoomAssignmentAvailability } from '../dto/room-assignment-availability.output';
import { AvailabilityChangedInterceptor } from '../mutation-event.interceptors';
import { toDateString } from '../utils/date-string.util';

@UseInterceptors(AvailabilityChangedInterceptor)
@Resolver(() => TemplateAssignment)
export class TemplateAssignmentResolver {
  constructor(
    private readonly assignmentService: TemplateAssignmentService,
    private readonly availabilityService: AvailabilityService,
    private readonly roomConflictService: RoomConflictService,
  ) {}

  /** Orizzonte di ricostruzione cache per le assegnazioni senza scadenza. */
  private defaultCacheEnd(): string {
    return new Date(new Date().setFullYear(new Date().getFullYear() + 1))
      .toISOString()
      .split('T')[0];
  }

  /** Ricostruisce la cache disponibilità sul periodo di un'assegnazione. */
  private async rebuildForAssignment(assignment: TemplateAssignment): Promise<void> {
    const start = toDateString(assignment.validFrom);
    let end = assignment.validUntil
      ? toDateString(assignment.validUntil)
      : this.defaultCacheEnd();
    if (end < start) end = start;
    await this.availabilityService.rebuildCache(assignment.operatorId, start, end);
  }

  @Query(() => [TemplateAssignment], { name: 'templateAssignments' })
  async getTemplateAssignments(
    @Args('operatorId', { type: () => ID, nullable: true }) operatorId?: string,
    @Args('onlyCurrent', { type: () => Boolean, nullable: true, defaultValue: true })
    onlyCurrent?: boolean,
  ): Promise<TemplateAssignment[]> {
    return this.assignmentService.findAll(operatorId, onlyCurrent);
  }

  @Query(() => TemplateAssignment, { name: 'templateAssignment', nullable: true })
  async getTemplateAssignment(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<TemplateAssignment> {
    return this.assignmentService.findOne(id);
  }

  @Query(() => [TemplateAssignment], { name: 'templateAssignmentsByOperator' })
  async getTemplateAssignmentsByOperator(
    @Args('operatorId', { type: () => ID }) operatorId: string,
    @Args('onlyCurrent', { type: () => Boolean, nullable: true, defaultValue: true })
    onlyCurrent?: boolean,
  ): Promise<TemplateAssignment[]> {
    return this.assignmentService.findByOperator(operatorId, onlyCurrent);
  }

  @Query(() => [TemplateAssignment], { name: 'currentTemplateAssignments' })
  async getCurrentTemplateAssignments(
    @Args('operatorId', { type: () => ID }) operatorId: string,
    @Args('date', { nullable: true }) dateStr?: string,
  ): Promise<TemplateAssignment[]> {
    const date = dateStr ? new Date(dateStr) : new Date();
    return this.assignmentService.findCurrentByOperator(operatorId, date);
  }

  /**
   * Pre-check dei conflitti di occupazione studi/poltrone per la UI: gli
   * errori bloccanti impediranno il salvataggio, i warning sono informativi.
   */
  @Query(() => RoomConflictCheckResult, { name: 'checkAssignmentRoomConflicts' })
  async checkAssignmentRoomConflicts(
    @Args('input') input: AssignTemplateToOperatorInput,
    @Args('excludeAssignmentId', { type: () => ID, nullable: true })
    excludeAssignmentId?: string,
  ): Promise<RoomConflictCheckResult> {
    return this.roomConflictService.checkForInput(input, excludeAssignmentId);
  }

  /**
   * Disponibilità di ogni studio/poltrona rispetto al template candidato:
   * alimenta le tendine filtrate (studi pieni disabilitati con motivo) e
   * l'editor grafico. Proiezione conservativa sulle date reali di validità.
   */
  @Query(() => RoomAssignmentAvailability, { name: 'assignmentRoomAvailability' })
  async assignmentRoomAvailability(
    @Args('input') input: AssignTemplateToOperatorInput,
    @Args('excludeAssignmentId', { type: () => ID, nullable: true })
    excludeAssignmentId?: string,
  ): Promise<RoomAssignmentAvailability> {
    return this.roomConflictService.availabilityForInput(input, excludeAssignmentId);
  }

  @Mutation(() => TemplateAssignment, { name: 'setAssignmentRoomOverrides' })
  async setAssignmentRoomOverrides(
    @Args('assignmentId', { type: () => ID }) assignmentId: string,
    @Args('overrides', { type: () => [AssignmentRoomOverrideInput] })
    overrides: AssignmentRoomOverrideInput[],
  ): Promise<TemplateAssignment> {
    return this.assignmentService.setRoomOverrides(assignmentId, overrides);
  }

  @Mutation(() => TemplateAssignment, { name: 'updateTemplateAssignment' })
  async updateTemplateAssignment(
    @Args('id', { type: () => ID }) id: string,
    @Args('validFrom', { nullable: true }) validFrom?: string,
    @Args('validUntil', { nullable: true }) validUntil?: string,
    @Args('patternStartDate', { nullable: true }) patternStartDate?: string,
    @Args('isCurrent', { nullable: true }) isCurrent?: boolean,
    @Args('roomId', { type: () => String, nullable: true }) roomId?: string,
    @Args('chairId', { type: () => String, nullable: true }) chairId?: string,
  ): Promise<TemplateAssignment> {
    const before = await this.assignmentService.findOne(id);
    const oldFrom = toDateString(before.validFrom);
    const oldUntil = before.validUntil ? toDateString(before.validUntil) : null;

    const updated = await this.assignmentService.update(id, {
      ...(validFrom !== undefined && { validFrom: new Date(validFrom) }),
      // Stringa vuota = rimozione della scadenza (assegnazione senza fine)
      ...(validUntil !== undefined && { validUntil: validUntil ? new Date(validUntil) : null }),
      ...(patternStartDate !== undefined && { patternStartDate: new Date(patternStartDate) }),
      ...(isCurrent !== undefined && { isCurrent }),
      // Stringa vuota = rimozione di studio/poltrona
      ...(roomId !== undefined && { roomId: roomId || null }),
      ...(chairId !== undefined && { chairId: chairId || null }),
    });

    // La cache va ricostruita sull'unione di vecchio e nuovo periodo: le date
    // uscite dalla validità perdono le fasce, quelle entrate le acquistano.
    const newFrom = toDateString(updated.validFrom);
    const newUntil = updated.validUntil ? toDateString(updated.validUntil) : null;
    const start = oldFrom < newFrom ? oldFrom : newFrom;
    let end =
      !oldUntil || !newUntil
        ? this.defaultCacheEnd()
        : oldUntil > newUntil
          ? oldUntil
          : newUntil;
    if (end < start) end = start;
    await this.availabilityService.rebuildCache(updated.operatorId, start, end);

    // Le finestre di validità sono cambiate: gli appuntamenti rimasti fuori
    // dalle fasce della nuova timeline vanno marcati subito come conflitti.
    await this.availabilityService.detectAndMarkTemplateConflicts([updated.operatorId]);

    return updated;
  }

  @Mutation(() => TemplateAssignment, { name: 'deactivateTemplateAssignment' })
  async deactivateTemplateAssignment(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<TemplateAssignment> {
    const deactivated = await this.assignmentService.deactivate(id);
    await this.rebuildForAssignment(deactivated);
    await this.availabilityService.detectAndMarkTemplateConflicts([deactivated.operatorId]);
    return deactivated;
  }

  @Mutation(() => Boolean, { name: 'deleteTemplateAssignment' })
  async deleteTemplateAssignment(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    const assignment = await this.assignmentService.findOne(id);
    const deleted = await this.assignmentService.delete(id);
    if (deleted) {
      await this.rebuildForAssignment(assignment);
      await this.availabilityService.detectAndMarkTemplateConflicts([assignment.operatorId]);
    }
    return deleted;
  }

  @Mutation(() => Boolean, { name: 'deactivateAllTemplateAssignmentsForOperator' })
  async deactivateAllTemplateAssignmentsForOperator(
    @Args('operatorId', { type: () => ID }) operatorId: string,
  ): Promise<boolean> {
    await this.assignmentService.deactivateAllForOperator(operatorId);
    await this.availabilityService.rebuildCache(
      operatorId,
      toDateString(new Date()),
      this.defaultCacheEnd(),
    );
    return true;
  }
}
