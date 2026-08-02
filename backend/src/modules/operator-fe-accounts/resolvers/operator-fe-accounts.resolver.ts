import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';

import { BillingWriteGuard } from '../../availability/guards/billing-write.guard';
import {
  CurrentUser,
  CurrentUserContext,
} from '../../users/decorators/current-user.decorator';
import { AppUserService } from '../../users/services/app-user.service';
import { SubjectLoader } from '../../registry/decorators/subject-loader.decorator';
import { RegistrySubjectLoader } from '../../registry/registry-subject.loader';
import { OperatorFeAccountsService } from '../services/operator-fe-accounts.service';
import { OperatorFeSettlement } from '../entities/operator-fe-settlement.entity';
import { OperatorFeAccountSettings } from '../entities/operator-fe-account-settings.entity';
import {
  OperatorFeAnalysis,
  BulkDeleteOperatorFeSettlementsResult,
} from '../dto/operator-fe-analysis.output';
import {
  GenerateOperatorFeSettlementsInput,
  PatchOperatorFeSettlementInput,
  UpdateOperatorFeAccountSettingsInput,
} from '../dto/operator-fe-accounts.input';

/**
 * CONTI FE (Statistiche → Conti FE). Le mutation sono azioni economiche →
 * BillingWriteGuard (segreteria/admin), come le altre scritture di billing.
 */
@Resolver(() => OperatorFeSettlement)
export class OperatorFeAccountsResolver {
  constructor(
    private readonly service: OperatorFeAccountsService,
    private readonly appUserService: AppUserService,
  ) {}

  // ==================== QUERIES ====================

  @Query(() => [OperatorFeAnalysis], { name: 'operatorFeAnalysis' })
  async operatorFeAnalysis(
    @Args('from', { type: () => String }) from: string,
    @Args('to', { type: () => String }) to: string,
    @SubjectLoader() subjectLoader: RegistrySubjectLoader,
    @Args('operatorAppUserIds', { type: () => [ID], nullable: true })
    operatorAppUserIds?: string[],
  ): Promise<OperatorFeAnalysis[]> {
    return this.service.analyze({ from, to, operatorAppUserIds }, subjectLoader);
  }

  @Query(() => [OperatorFeSettlement], { name: 'operatorFeSettlements' })
  async operatorFeSettlements(
    @Args('operatorAppUserId', { type: () => ID, nullable: true })
    operatorAppUserId?: string,
  ): Promise<OperatorFeSettlement[]> {
    return this.service.findSettlements(operatorAppUserId);
  }

  @Query(() => OperatorFeSettlement, {
    name: 'operatorFeSettlement',
    nullable: true,
  })
  async operatorFeSettlement(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<OperatorFeSettlement> {
    return this.service.findSettlementById(id);
  }

  @Query(() => OperatorFeAccountSettings, { name: 'operatorFeAccountSettings' })
  async operatorFeAccountSettings(): Promise<OperatorFeAccountSettings> {
    return this.service.getSettings();
  }

  // ==================== MUTATIONS ====================

  @Mutation(() => [OperatorFeSettlement], {
    name: 'generateOperatorFeSettlements',
  })
  @UseGuards(BillingWriteGuard)
  async generateOperatorFeSettlements(
    @Args('input') input: GenerateOperatorFeSettlementsInput,
    @SubjectLoader() subjectLoader: RegistrySubjectLoader,
    @CurrentUser() user?: CurrentUserContext,
  ): Promise<OperatorFeSettlement[]> {
    const appUserId = await this.resolveAppUserId(user);
    return this.service.generateSettlements(
      input,
      appUserId,
      user?.email,
      subjectLoader,
    );
  }

  @Mutation(() => OperatorFeSettlement, { name: 'patchOperatorFeSettlement' })
  @UseGuards(BillingWriteGuard)
  async patchOperatorFeSettlement(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: PatchOperatorFeSettlementInput,
  ): Promise<OperatorFeSettlement> {
    return this.service.patchSettlement(id, input);
  }

  @Mutation(() => BulkDeleteOperatorFeSettlementsResult, {
    name: 'bulkDeleteOperatorFeSettlements',
  })
  @UseGuards(BillingWriteGuard)
  async bulkDeleteOperatorFeSettlements(
    @Args('ids', { type: () => [ID] }) ids: string[],
  ): Promise<BulkDeleteOperatorFeSettlementsResult> {
    return this.service.bulkDeleteSettlements(ids);
  }

  @Mutation(() => OperatorFeAccountSettings, {
    name: 'updateOperatorFeAccountSettings',
  })
  @UseGuards(BillingWriteGuard)
  async updateOperatorFeAccountSettings(
    @Args('input') input: UpdateOperatorFeAccountSettingsInput,
  ): Promise<OperatorFeAccountSettings> {
    return this.service.updateSettings(input);
  }

  private async resolveAppUserId(
    user: CurrentUserContext | undefined,
  ): Promise<string | undefined> {
    if (!user?.userId) return undefined;
    const appUser = await this.appUserService.findByKeycloakId(user.userId);
    return appUser?.id;
  }
}
