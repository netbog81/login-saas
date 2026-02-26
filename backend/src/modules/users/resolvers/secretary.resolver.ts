import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { Secretary } from '../entities/secretary.entity';
import { SecretaryService } from '../services/secretary.service';
import { CreateSecretaryInput } from '../dto/create-secretary.input';

@Resolver(() => Secretary)
export class SecretaryResolver {
  constructor(private readonly secretaryService: SecretaryService) {}

  @Query(() => [Secretary], { name: 'secretaries' })
  async findAll(): Promise<Secretary[]> {
    return this.secretaryService.findAll();
  }

  @Query(() => Secretary, { name: 'secretary', nullable: true })
  async findOne(@Args('id', { type: () => ID }) id: string): Promise<Secretary> {
    return this.secretaryService.findById(id);
  }

  @Mutation(() => Secretary)
  async createSecretary(@Args('input') input: CreateSecretaryInput): Promise<Secretary> {
    return this.secretaryService.create(input);
  }

  @Mutation(() => Boolean)
  async deleteSecretary(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    return this.secretaryService.delete(id);
  }
}
