import { Resolver, Query, Mutation, Args, ID, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Service } from '../entities/service.entity';
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
  async getServices(): Promise<Service[]> {
    return this.serviceRepo.find({
      order: { name: 'ASC' },
    });
  }

  @Query(() => Service, { name: 'service', nullable: true })
  // @UseGuards(GqlAuthGuard)
  async getService(
    @Args('id', { type: () => ID }) id: string
  ): Promise<Service | null> {
    return this.serviceRepo.findOne({ where: { id } });
  }

  // Mutations
  @Mutation(() => Service, { name: 'createService' })
  // @UseGuards(GqlAuthGuard)
  async createService(
    @Args('name') name: string,
    @Args('defaultDuration', { type: () => Int }) defaultDuration: number,
    @Args('description', { nullable: true }) description?: string,
    @Args('defaultPrice', { nullable: true }) defaultPrice?: number,
    @Args('bufferTimeBefore', { type: () => Int, nullable: true }) bufferTimeBefore?: number,
    @Args('bufferTimeAfter', { type: () => Int, nullable: true }) bufferTimeAfter?: number,
    @Args('color', { nullable: true }) color?: string,
    @Args('isActive', { nullable: true }) isActive?: boolean,
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
    });

    const service = await this.serviceRepo.findOne({ where: { id } });
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