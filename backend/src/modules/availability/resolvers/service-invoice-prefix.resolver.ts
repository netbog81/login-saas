import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { ServiceInvoicePrefix } from '../entities/service-invoice-prefix.entity';
import { ServiceInvoicePrefixService } from '../services/service-invoice-prefix.service';
import { UpsertServiceInvoicePrefixInput } from '../dto/service-invoice-prefix.input';

@Resolver(() => ServiceInvoicePrefix)
export class ServiceInvoicePrefixResolver {
  constructor(private readonly service: ServiceInvoicePrefixService) {}

  @Query(() => [ServiceInvoicePrefix], { name: 'serviceInvoicePrefixes' })
  getAll(): Promise<ServiceInvoicePrefix[]> {
    return this.service.findAll();
  }

  @Mutation(() => ServiceInvoicePrefix, { name: 'upsertServiceInvoicePrefix' })
  upsert(
    @Args('input') input: UpsertServiceInvoicePrefixInput,
  ): Promise<ServiceInvoicePrefix> {
    return this.service.upsert(input.macroCategory, input.prefix);
  }
}
