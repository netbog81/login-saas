import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { Site } from '../entities/site.entity';
import { SiteService } from '../services/site.service';

/**
 * Sedi operative del tenant — il clinico ne è il master, accounting tiene
 * una replica allineata via `site.upserted`.
 */
@Resolver(() => Site)
export class SiteResolver {
  constructor(private readonly siteService: SiteService) {}

  @Query(() => [Site], { name: 'sites' })
  async getSites(
    @Args('onlyActive', { type: () => Boolean, nullable: true, defaultValue: false })
    onlyActive?: boolean,
  ): Promise<Site[]> {
    return this.siteService.findAll(onlyActive);
  }

  @Mutation(() => Site, { name: 'createSite' })
  async createSite(
    @Args('name') name: string,
    @Args('address', { nullable: true }) address?: string,
  ): Promise<Site> {
    return this.siteService.create({ name, address });
  }

  @Mutation(() => Site, { name: 'updateSite' })
  async updateSite(
    @Args('id', { type: () => ID }) id: string,
    @Args('name', { nullable: true }) name?: string,
    @Args('address', { nullable: true }) address?: string,
    @Args('isActive', { nullable: true }) isActive?: boolean,
  ): Promise<Site> {
    return this.siteService.update(id, {
      ...(name !== undefined && { name }),
      ...(address !== undefined && { address }),
      ...(isActive !== undefined && { isActive }),
    });
  }

  /** Sposta la designazione di predefinita; restituisce l'elenco aggiornato. */
  @Mutation(() => [Site], { name: 'setDefaultSite' })
  async setDefaultSite(@Args('id', { type: () => ID }) id: string): Promise<Site[]> {
    return this.siteService.setDefault(id);
  }

  /** Ripubblica tutte le sedi verso accounting; ritorna quante ne ha inviate. */
  @Mutation(() => Number, { name: 'resyncSitesToAccounting' })
  async resyncSitesToAccounting(): Promise<number> {
    return this.siteService.resyncToAccounting();
  }
}
