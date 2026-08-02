import { UseInterceptors } from '@nestjs/common';
import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { TemplateAssignment } from '../entities/template-assignment.entity';
import { TemplateAssignmentService } from '../services/template-assignment.service';
import { AvailabilityChangedInterceptor } from '../mutation-event.interceptors';

@UseInterceptors(AvailabilityChangedInterceptor)
@Resolver(() => TemplateAssignment)
export class TemplateAssignmentResolver {
  constructor(private readonly assignmentService: TemplateAssignmentService) {}

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

  @Mutation(() => TemplateAssignment, { name: 'updateTemplateAssignment' })
  async updateTemplateAssignment(
    @Args('id', { type: () => ID }) id: string,
    @Args('validFrom', { nullable: true }) validFrom?: string,
    @Args('validUntil', { nullable: true }) validUntil?: string,
    @Args('patternStartDate', { nullable: true }) patternStartDate?: string,
    @Args('isCurrent', { nullable: true }) isCurrent?: boolean,
  ): Promise<TemplateAssignment> {
    return this.assignmentService.update(id, {
      ...(validFrom !== undefined && { validFrom: new Date(validFrom) }),
      ...(validUntil !== undefined && { validUntil: validUntil ? new Date(validUntil) : undefined }),
      ...(patternStartDate !== undefined && { patternStartDate: new Date(patternStartDate) }),
      ...(isCurrent !== undefined && { isCurrent }),
    });
  }

  @Mutation(() => TemplateAssignment, { name: 'deactivateTemplateAssignment' })
  async deactivateTemplateAssignment(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<TemplateAssignment> {
    return this.assignmentService.deactivate(id);
  }

  @Mutation(() => Boolean, { name: 'deleteTemplateAssignment' })
  async deleteTemplateAssignment(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.assignmentService.delete(id);
  }

  @Mutation(() => Boolean, { name: 'deactivateAllTemplateAssignmentsForOperator' })
  async deactivateAllTemplateAssignmentsForOperator(
    @Args('operatorId', { type: () => ID }) operatorId: string,
  ): Promise<boolean> {
    await this.assignmentService.deactivateAllForOperator(operatorId);
    return true;
  }
}
