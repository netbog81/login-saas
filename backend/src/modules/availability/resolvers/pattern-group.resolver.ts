import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { PatternGroup } from '../entities/pattern-group.entity';
import { PatternGroupService } from '../services/pattern-group.service';
import { CreatePatternGroupInput } from '../dto/create-pattern-group.input';
import { UpdatePatternGroupInput } from '../dto/update-pattern-group.input';

@Resolver(() => PatternGroup)
export class PatternGroupResolver {
  constructor(private readonly patternGroupService: PatternGroupService) {}

  @Query(() => [PatternGroup], { name: 'patternGroups' })
  async getPatternGroups(): Promise<PatternGroup[]> {
    return this.patternGroupService.findAll();
  }

  @Query(() => PatternGroup, { name: 'patternGroup', nullable: true })
  async getPatternGroup(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<PatternGroup> {
    return this.patternGroupService.findOne(id);
  }

  @Mutation(() => PatternGroup, { name: 'createPatternGroup' })
  async createPatternGroup(
    @Args('input') input: CreatePatternGroupInput,
  ): Promise<PatternGroup> {
    return this.patternGroupService.create(input);
  }

  @Mutation(() => PatternGroup, { name: 'updatePatternGroup' })
  async updatePatternGroup(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdatePatternGroupInput,
  ): Promise<PatternGroup> {
    return this.patternGroupService.update(id, input);
  }

  @Mutation(() => Boolean, { name: 'deletePatternGroup' })
  async deletePatternGroup(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.patternGroupService.delete(id);
  }

  @Mutation(() => PatternGroup, { name: 'setPatternGroupActive' })
  async setPatternGroupActive(
    @Args('id', { type: () => ID }) id: string,
    @Args('isActive') isActive: boolean,
  ): Promise<PatternGroup> {
    return this.patternGroupService.setActive(id, isActive);
  }
}
