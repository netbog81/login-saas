import { Resolver, Query, Args, ID } from '@nestjs/graphql';
import { ForbiddenException, UseGuards } from '@nestjs/common';

import { PendingFeCollections } from '../dto/pending-fe-collection.output';
import {
  PendingFeCollectionsService,
  PendingFeCaller,
} from '../services/pending-fe-collections.service';
import {
  AuthorizationGuard,
  RequirePermissions,
} from '../../users/guards/authorization.guard';
import { AppUserService } from '../../users/services/app-user.service';
import {
  CurrentUser,
  CurrentUserContext,
} from '../../users/decorators/current-user.decorator';
import { BILLING_SECRETARY_ROLES } from '../guards/billing-write.guard';

/**
 * Allarme "sconto FE da incassare" della cartella paziente.
 *
 * Sola lettura: l'incasso passa dalla mutation esistente
 * `recordTreatmentPayment`, che riapplica gli stessi controlli
 * (PendingFeCollectionsService.denyReasonForCollect).
 */
@Resolver(() => PendingFeCollections)
export class PendingFeCollectionsResolver {
  constructor(
    private readonly pendingFeService: PendingFeCollectionsService,
    private readonly appUserService: AppUserService,
  ) {}

  /**
   * Sconto FE non incassati del paziente (fisioterapia + palestra).
   *
   * Chiunque possa leggere i trattamenti li vede TUTTI, anche quelli di altri
   * operatori: l'impostazione `payments.scontoFeCollectAnyOperator` governa
   * solo il `canCollect` di ogni riga.
   */
  @Query(() => PendingFeCollections, { name: 'patientPendingFeCollections' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('treatment_read')
  async patientPendingFeCollections(
    @Args('patientId', { type: () => ID }) patientId: string,
    @CurrentUser() user?: CurrentUserContext,
  ): Promise<PendingFeCollections> {
    return this.pendingFeService.listForPatient(
      patientId,
      await this.resolveCaller(user),
    );
  }

  /**
   * Identità del chiamante derivata SERVER-SIDE: AppUser dal `sub` Keycloak,
   * ruolo segreteria dai ruoli del JWT. Niente di tutto ciò arriva dal client.
   */
  private async resolveCaller(
    user: CurrentUserContext | undefined,
  ): Promise<PendingFeCaller> {
    if (!user) {
      throw new ForbiddenException('Autenticazione richiesta');
    }
    const appUser = user.userId
      ? await this.appUserService.findByKeycloakId(user.userId)
      : null;
    const roles: string[] = user.roles || [];
    return {
      appUserId: appUser?.id ?? null,
      isSecretary: roles.some((r) => BILLING_SECRETARY_ROLES.includes(r)),
    };
  }
}
