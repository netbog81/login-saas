import { Resolver, Query, Mutation, Args, ID, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Service } from '../entities/service.entity';
import { OperatorMacroCategory } from '../entities/operator-macro-category.enum';
// import { GqlAuthGuard } from '../../auth/guards/gql-auth.guard'; // Uncomment when auth is ready

@Resolver(() => Service)
export class ServiceResolver {
  constructor(
    @InjectRepository(Service)
    private serviceRepo: Repository<Service>,
  ) {}

  // Queries
  @Query(() => [Service], { name: 'services' })
  // @UseGuards(GqlAuthGuard)
  async getServices(
    @Args('macroCategory', { type: () => OperatorMacroCategory, nullable: true })
    macroCategory?: OperatorMacroCategory,
    @Args('onlyActive', { type: () => Boolean, nullable: true, defaultValue: false })
    onlyActive?: boolean,
  ): Promise<Service[]> {
    const where: any = {};
    if (macroCategory) where.macroCategory = macroCategory;
    if (onlyActive) where.isActive = true;

    return this.serviceRepo.find({
      where,
      relations: ['requiredInstruments', 'requiredInstruments.instrumentCategory', 'subcategory'],
      order: { name: 'ASC' },
    });
  }

  @Query(() => Service, { name: 'service', nullable: true })
  // @UseGuards(GqlAuthGuard)
  async getService(
    @Args('id', { type: () => ID }) id: string
  ): Promise<Service | null> {
    return this.serviceRepo.findOne({
      where: { id },
      relations: ['requiredInstruments', 'requiredInstruments.instrumentCategory', 'subcategory'],
    });
  }

  // Mutations
  @Mutation(() => Service, { name: 'createService' })
  // @UseGuards(GqlAuthGuard)
  async createService(
    @Args('name') name: string,
    @Args('defaultDuration', { type: () => Int }) defaultDuration: number,
    @Args('macroCategory', { type: () => OperatorMacroCategory, nullable: true })
    macroCategory?: OperatorMacroCategory,
    @Args('description', { nullable: true }) description?: string,
    @Args('defaultPrice', { nullable: true }) defaultPrice?: number,
    @Args('bufferTimeBefore', { type: () => Int, nullable: true }) bufferTimeBefore?: number,
    @Args('bufferTimeAfter', { type: () => Int, nullable: true }) bufferTimeAfter?: number,
    @Args('color', { nullable: true }) color?: string,
    @Args('isActive', { nullable: true }) isActive?: boolean,
    @Args('preferredDuration', { type: () => Int, nullable: true }) preferredDuration?: number,
    @Args('instrumentOrderMatters', { nullable: true }) instrumentOrderMatters?: boolean,
    @Args('subcategoryId', { type: () => ID, nullable: true }) subcategoryId?: string,
    @Args('discountFE', { nullable: true }) discountFE?: number,
  ): Promise<Service> {
    const service = this.serviceRepo.create({
      name,
      description,
      defaultDuration,
      defaultPrice: defaultPrice || 0,
      bufferTimeBefore: bufferTimeBefore || 0,
      bufferTimeAfter: bufferTimeAfter || 0,
      color,
      isActive: isActive !== false,
      macroCategory,
      preferredDuration,
      instrumentOrderMatters: instrumentOrderMatters || false,
      subcategoryId,
      discountFE,
    });

    return this.serviceRepo.save(service);
  }

  @Mutation(() => Service, { name: 'updateService' })
  // @UseGuards(GqlAuthGuard)
  async updateService(
    @Args('id', { type: () => ID }) id: string,
    @Args('name', { nullable: true }) name?: string,
    @Args('description', { nullable: true }) description?: string,
    @Args('defaultDuration', { type: () => Int, nullable: true }) defaultDuration?: number,
    @Args('defaultPrice', { nullable: true }) defaultPrice?: number,
    @Args('bufferTimeBefore', { type: () => Int, nullable: true }) bufferTimeBefore?: number,
    @Args('bufferTimeAfter', { type: () => Int, nullable: true }) bufferTimeAfter?: number,
    @Args('color', { nullable: true }) color?: string,
    @Args('isActive', { nullable: true }) isActive?: boolean,
    @Args('macroCategory', { type: () => OperatorMacroCategory, nullable: true })
    macroCategory?: OperatorMacroCategory,
    @Args('preferredDuration', { type: () => Int, nullable: true }) preferredDuration?: number,
    @Args('instrumentOrderMatters', { nullable: true }) instrumentOrderMatters?: boolean,
    @Args('subcategoryId', { type: () => ID, nullable: true }) subcategoryId?: string,
    @Args('discountFE', { nullable: true }) discountFE?: number,
  ): Promise<Service> {
    await this.serviceRepo.update(id, {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(defaultDuration !== undefined && { defaultDuration }),
      ...(defaultPrice !== undefined && { defaultPrice }),
      ...(bufferTimeBefore !== undefined && { bufferTimeBefore }),
      ...(bufferTimeAfter !== undefined && { bufferTimeAfter }),
      ...(color !== undefined && { color }),
      ...(isActive !== undefined && { isActive }),
      ...(macroCategory !== undefined && { macroCategory }),
      ...(preferredDuration !== undefined && { preferredDuration }),
      ...(instrumentOrderMatters !== undefined && { instrumentOrderMatters }),
      ...(subcategoryId !== undefined && { subcategoryId }),
      ...(discountFE !== undefined && { discountFE }),
    });

    const service = await this.serviceRepo.findOne({
      where: { id },
      relations: ['requiredInstruments', 'requiredInstruments.instrumentCategory', 'subcategory'],
    });
    if (!service) {
      throw new Error('Service not found');
    }

    return service;
  }

  @Mutation(() => Boolean, { name: 'deleteService' })
  // @UseGuards(GqlAuthGuard)
  async deleteService(
    @Args('id', { type: () => ID }) id: string
  ): Promise<boolean> {
    const result = await this.serviceRepo.delete(id);
    return result.affected ? result.affected > 0 : false;
  }
}