import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { Logger } from '@nestjs/common';
import { WaitingListEntry, WaitingListStatus } from '../entities/waiting-list-entry.entity';
import { WaitingListService } from '../services/waiting-list.service';
import {
  CreateWaitingListEntryInput,
  UpdateWaitingListEntryInput,
  ReorderWaitingListInput,
} from '../dto/waiting-list.input';

@Resolver(() => WaitingListEntry)
export class WaitingListResolver {
  private readonly logger = new Logger(WaitingListResolver.name);

  constructor(
    private readonly waitingListService: WaitingListService,
  ) {}

  @Query(() => [WaitingListEntry], { name: 'waitingListEntries' })
  async getWaitingListEntries(
    @Args('status', { type: () => WaitingListStatus, nullable: true })
    status?: WaitingListStatus,
  ): Promise<WaitingListEntry[]> {
    return this.waitingListService.findAll(status);
  }

  @Query(() => WaitingListEntry, { name: 'waitingListEntry', nullable: true })
  async getWaitingListEntry(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<WaitingListEntry | null> {
    try {
      return await this.waitingListService.findById(id);
    } catch {
      return null;
    }
  }

  @Mutation(() => WaitingListEntry, { name: 'createWaitingListEntry' })
  async createWaitingListEntry(
    @Args('input') input: CreateWaitingListEntryInput,
  ): Promise<WaitingListEntry> {
    return this.waitingListService.create(input);
  }

  @Mutation(() => WaitingListEntry, { name: 'updateWaitingListEntry' })
  async updateWaitingListEntry(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateWaitingListEntryInput,
  ): Promise<WaitingListEntry> {
    return this.waitingListService.update(id, input);
  }

  @Mutation(() => Boolean, { name: 'deleteWaitingListEntry' })
  async deleteWaitingListEntry(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.waitingListService.remove(id);
  }

  @Mutation(() => [WaitingListEntry], { name: 'reorderWaitingList' })
  async reorderWaitingList(
    @Args('input') input: ReorderWaitingListInput,
  ): Promise<WaitingListEntry[]> {
    return this.waitingListService.reorder(input.entries);
  }
}
