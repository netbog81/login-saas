import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';

import { CurrentUser, CurrentUserContext } from '../users/decorators/current-user.decorator';
import { AuthorizationGuard, RequirePermissions } from '../users/guards/authorization.guard';
import { AppUserService } from '../users/services/app-user.service';

import { SaleService } from './sale.service';
import { RecordProductSaleInput, SaleCompletedResult } from './sale.types';

/**
 * Resolver GraphQL per le operazioni di vendita rapida prodotto.
 *
 * Permission: riusa `treatment_write` per MVP (la segretaria che può
 * creare/aggiornare trattamenti può anche fare vendite rapide). Per
 * separazione fine-grain in futuro, eventuale `sale_record` dedicato.
 */
@Resolver()
export class SaleResolver {
  constructor(
    private readonly saleService: SaleService,
    private readonly appUserService: AppUserService,
  ) {}

  @Mutation(() => SaleCompletedResult, { name: 'recordProductSale' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('treatment_write')
  async recordProductSale(
    @Args('input') input: RecordProductSaleInput,
    @CurrentUser() user?: CurrentUserContext,
  ): Promise<SaleCompletedResult> {
    if (!user?.userId) {
      throw new Error('recordProductSale: CurrentUser non disponibile');
    }
    // Risolve AppUser.id locale dal Keycloak sub (pattern coerente con
    // gli altri resolver del clinico). Il SaleService accetta l'AppUser.id
    // perché poi fa lookup `keycloakId` per il payload.
    const appUser = await this.appUserService.findByKeycloakId(user.userId);
    if (!appUser) {
      throw new Error(
        `recordProductSale: AppUser non trovato per Keycloak sub "${user.userId}"`,
      );
    }
    return this.saleService.recordProductSale(input, appUser.id);
  }
}
