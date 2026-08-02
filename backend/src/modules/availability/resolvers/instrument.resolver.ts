import { UseInterceptors } from '@nestjs/common';
import { Resolver, Query, Mutation, Args, ID, GraphQLISODateTime } from '@nestjs/graphql';
import { Instrument } from '../entities/instrument.entity';
import { InstrumentStatus } from '../entities/instrument-status.enum';
import { InstrumentService } from '../services/instrument.service';
import GraphQLJSON from 'graphql-type-json';
import { AvailabilityChangedInterceptor } from '../mutation-event.interceptors';

@UseInterceptors(AvailabilityChangedInterceptor)
@Resolver(() => Instrument)
export class InstrumentResolver {
  constructor(private readonly instrumentService: InstrumentService) {}

  @Query(() => [Instrument], { name: 'instruments' })
  async getInstruments(
    @Args('categoryId', { type: () => ID, nullable: true }) categoryId?: string,
    @Args('status', { type: () => InstrumentStatus, nullable: true }) status?: InstrumentStatus,
  ): Promise<Instrument[]> {
    return this.instrumentService.findAll(categoryId, status);
  }

  @Query(() => Instrument, { name: 'instrument', nullable: true })
  async getInstrument(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Instrument> {
    return this.instrumentService.findOne(id);
  }

  @Query(() => [Instrument], { name: 'availableInstrumentsByCategory' })
  async getAvailableInstrumentsByCategory(
    @Args('categoryId', { type: () => ID }) categoryId: string,
  ): Promise<Instrument[]> {
    return this.instrumentService.findAvailableByCategory(categoryId);
  }

  @Mutation(() => Instrument, { name: 'createInstrument' })
  async createInstrument(
    @Args('categoryId', { type: () => ID }) categoryId: string,
    @Args('name') name: string,
    @Args('brand', { nullable: true }) brand?: string,
    @Args('model', { nullable: true }) model?: string,
    @Args('verificationExpiry', { type: () => GraphQLISODateTime, nullable: true }) verificationExpiry?: Date,
    @Args('technicalData', { type: () => GraphQLJSON, nullable: true }) technicalData?: Record<string, any>,
    @Args('color', { nullable: true }) color?: string,
  ): Promise<Instrument> {
    return this.instrumentService.create({
      categoryId,
      name,
      brand,
      model,
      verificationExpiry,
      technicalData,
      color,
    });
  }

  @Mutation(() => Instrument, { name: 'updateInstrument' })
  async updateInstrument(
    @Args('id', { type: () => ID }) id: string,
    @Args('name', { nullable: true }) name?: string,
    @Args('categoryId', { type: () => ID, nullable: true }) categoryId?: string,
    @Args('brand', { nullable: true }) brand?: string,
    @Args('model', { nullable: true }) model?: string,
    @Args('verificationExpiry', { type: () => GraphQLISODateTime, nullable: true }) verificationExpiry?: Date,
    @Args('status', { type: () => InstrumentStatus, nullable: true }) status?: InstrumentStatus,
    @Args('technicalData', { type: () => GraphQLJSON, nullable: true }) technicalData?: Record<string, any>,
    @Args('color', { nullable: true }) color?: string,
    @Args('isActive', { nullable: true }) isActive?: boolean,
  ): Promise<Instrument> {
    return this.instrumentService.update(id, {
      ...(name !== undefined && { name }),
      ...(categoryId !== undefined && { categoryId }),
      ...(brand !== undefined && { brand }),
      ...(model !== undefined && { model }),
      ...(verificationExpiry !== undefined && { verificationExpiry }),
      ...(status !== undefined && { status }),
      ...(technicalData !== undefined && { technicalData }),
      ...(color !== undefined && { color }),
      ...(isActive !== undefined && { isActive }),
    });
  }

  @Mutation(() => Instrument, { name: 'setInstrumentStatus' })
  async setInstrumentStatus(
    @Args('id', { type: () => ID }) id: string,
    @Args('status', { type: () => InstrumentStatus }) status: InstrumentStatus,
  ): Promise<Instrument> {
    return this.instrumentService.setStatus(id, status);
  }

  @Mutation(() => Boolean, { name: 'deleteInstrument' })
  async deleteInstrument(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.instrumentService.delete(id);
  }
}
