import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { ItManager } from '../entities/it-manager.entity';
import { ItManagerService } from '../services/it-manager.service';
import { CreateItManagerInput } from '../dto/create-it-manager.input';

@Resolver(() => ItManager)
export class ItManagerResolver {
  constructor(private readonly itManagerService: ItManagerService) {}

  @Query(() => [ItManager], { name: 'itManagers' })
  async findAll(): Promise<ItManager[]> {
    return this.itManagerService.findAll();
  }

  @Query(() => ItManager, { name: 'itManager', nullable: true })
  async findOne(@Args('id', { type: () => ID }) id: string): Promise<ItManager> {
    return this.itManagerService.findById(id);
  }

  @Mutation(() => ItManager)
  async createItManager(@Args('input') input: CreateItManagerInput): Promise<ItManager> {
    return this.itManagerService.create(input);
  }

  @Mutation(() => Boolean)
  async deleteItManager(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    return this.itManagerService.delete(id);
  }
}
