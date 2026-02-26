import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { PrivacyOfficer } from '../entities/privacy-officer.entity';
import { PrivacyOfficerService } from '../services/privacy-officer.service';
import { CreatePrivacyOfficerInput } from '../dto/create-privacy-officer.input';

@Resolver(() => PrivacyOfficer)
export class PrivacyOfficerResolver {
  constructor(private readonly poService: PrivacyOfficerService) {}

  @Query(() => [PrivacyOfficer], { name: 'privacyOfficers' })
  async findAll(): Promise<PrivacyOfficer[]> {
    return this.poService.findAll();
  }

  @Query(() => PrivacyOfficer, { name: 'privacyOfficer', nullable: true })
  async findOne(@Args('id', { type: () => ID }) id: string): Promise<PrivacyOfficer> {
    return this.poService.findById(id);
  }

  @Mutation(() => PrivacyOfficer)
  async createPrivacyOfficer(@Args('input') input: CreatePrivacyOfficerInput): Promise<PrivacyOfficer> {
    return this.poService.create(input);
  }

  @Mutation(() => Boolean)
  async deletePrivacyOfficer(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    return this.poService.delete(id);
  }
}
