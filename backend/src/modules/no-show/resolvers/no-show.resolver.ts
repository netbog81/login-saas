import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';

import { BillingWriteGuard } from '../../availability/guards/billing-write.guard';
import {
  CurrentUser,
  CurrentUserContext,
} from '../../users/decorators/current-user.decorator';
import { AppUserService } from '../../users/services/app-user.service';
import { NoShowService } from '../services/no-show.service';
import { NoShowReview } from '../entities/no-show-review.entity';
import {
  NoShowEventPage,
  NoShowPatientPage,
  NoShowSummary,
} from '../models/no-show.models';
import {
  NoShowFilterInput,
  NoShowPagingInput,
  UpsertNoShowReviewInput,
} from '../dto/no-show.input';

/**
 * GESTIONE ASSENZE INGIUSTIFICATE (Statistiche → No Show).
 *
 * Le QUERY sono in sola lettura e restano accessibili anche all'operatore:
 * sapere che un paziente ha già saltato tre sedute è informazione utile in
 * sala. Le MUTATION di valutazione invece sono riservate ai ruoli di
 * fatturazione (BillingWriteGuard): decidere se addebitare una seduta
 * saltata è fatturazione a tutti gli effetti.
 */
@Resolver(() => NoShowReview)
export class NoShowResolver {
  constructor(
    private readonly service: NoShowService,
    private readonly appUserService: AppUserService,
  ) {}

  // ==================== QUERIES ====================

  /** Riepilogo KPI del periodo/filtro. */
  @Query(() => NoShowSummary, { name: 'noShowSummary' })
  async summary(
    @Args('filter', { type: () => NoShowFilterInput, nullable: true })
    filter?: NoShowFilterInput,
  ): Promise<NoShowSummary> {
    return this.service.summary(filter ?? {});
  }

  /** Elenco piatto degli eventi, ordinati dal più recente. */
  @Query(() => NoShowEventPage, { name: 'noShowEvents' })
  async events(
    @Args('filter', { type: () => NoShowFilterInput, nullable: true })
    filter?: NoShowFilterInput,
    @Args('paging', { type: () => NoShowPagingInput, nullable: true })
    paging?: NoShowPagingInput,
  ): Promise<NoShowEventPage> {
    return this.service.findEvents(filter ?? {}, paging);
  }

  /** Vista ad albero: un nodo per paziente con i suoi eventi. */
  @Query(() => NoShowPatientPage, { name: 'noShowByPatient' })
  async byPatient(
    @Args('filter', { type: () => NoShowFilterInput, nullable: true })
    filter?: NoShowFilterInput,
    @Args('paging', { type: () => NoShowPagingInput, nullable: true })
    paging?: NoShowPagingInput,
  ): Promise<NoShowPatientPage> {
    return this.service.findByPatient(filter ?? {}, paging);
  }

  // ==================== MUTATIONS ====================

  /**
   * Registra (o corregge) la decisione dello staff su un'assenza.
   */
  @UseGuards(BillingWriteGuard)
  @Mutation(() => NoShowReview, { name: 'upsertNoShowReview' })
  async upsertReview(
    @Args('input') input: UpsertNoShowReviewInput,
    @CurrentUser() user: CurrentUserContext,
  ): Promise<NoShowReview> {
    return this.service.upsertReview(input, await this.resolveDecider(user));
  }

  /** Rimuove la valutazione: l'evento torna "da valutare". */
  @UseGuards(BillingWriteGuard)
  @Mutation(() => Boolean, { name: 'deleteNoShowReview' })
  async deleteReview(
    @Args('appointmentId', { type: () => ID }) appointmentId: string,
  ): Promise<boolean> {
    return this.service.deleteReview(appointmentId);
  }

  /**
   * Nome di chi decide, snapshottato sulla review: sopravvive alla
   * rimozione dell'utente. `user.userId` è il `sub` Keycloak, non l'id di
   * AppUser: va risolto.
   */
  private async resolveDecider(
    user?: CurrentUserContext,
  ): Promise<{ userId?: string; name?: string }> {
    if (!user?.userId) return {};
    try {
      const appUser = await this.appUserService.findByKeycloakId(user.userId);
      const name = appUser
        ? [appUser.name, appUser.surname].filter(Boolean).join(' ').trim()
        : undefined;
      return { userId: user.userId, name: name || undefined };
    } catch {
      // Il nome è un di più: se il lookup fallisce si salva comunque l'id.
      return { userId: user.userId };
    }
  }
}
