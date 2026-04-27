import {
  Resolver,
  Query,
  Mutation,
  Args,
  ID,
  Int,
} from '@nestjs/graphql';
import { ForbiddenException, NotFoundException, UseGuards } from '@nestjs/common';
import { RecycleBinService } from '../services/recycle-bin.service';
import {
  RecycleBinItem,
  RecycleBinEntityType,
} from '../dto/recycle-bin-item.type';
import { RecycleBinFilterInput } from '../dto/recycle-bin-filter.input';
import { RecycleBinSettings } from '../../availability/entities/recycle-bin-settings.entity';
import {
  AuthorizationGuard,
  RequirePermissions,
} from '../../users/guards/authorization.guard';
import {
  CurrentUser,
  CurrentUserContext,
} from '../../users/decorators/current-user.decorator';
import { AppUserService } from '../../users/services/app-user.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import { Treatment } from '../../availability/entities/treatment.entity';
import { TherapeuticPath } from '../../availability/entities/therapeutic-path.entity';
import { PatientEvaluation } from '../../availability/entities/patient-evaluation.entity';
import { Operator } from '../../availability/entities/operator.entity';

@Resolver()
export class RecycleBinResolver {
  constructor(
    private readonly recycleBinService: RecycleBinService,
    private readonly appUserService: AppUserService,
    @InjectRepository(Treatment)
    private readonly treatmentRepo: Repository<Treatment>,
    @InjectRepository(TherapeuticPath)
    private readonly pathRepo: Repository<TherapeuticPath>,
    @InjectRepository(PatientEvaluation)
    private readonly evaluationRepo: Repository<PatientEvaluation>,
    @InjectRepository(Operator)
    private readonly operatorRepo: Repository<Operator>,
  ) {}

  /**
   * Restituisce la lista degli elementi nel cestino visibili al chiamante.
   *
   * Visibilità:
   * - Utente con `recycle_bin_restore_any` (admin) → vede TUTTO,
   *   o filtra liberamente per `ownerUserId`.
   * - Utente con solo `recycle_bin_view` (operatori) → vede solo i propri:
   *   il filtro `ownerUserId` è forzato server-side al proprio appUserId,
   *   anche se il client ne passa uno diverso.
   */
  @Query(() => [RecycleBinItem], { name: 'recycleBin' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('recycle_bin_view')
  async listRecycleBin(
    @Args('filter', { nullable: true }) filter: RecycleBinFilterInput | undefined,
    @CurrentUser() user: CurrentUserContext,
  ): Promise<RecycleBinItem[]> {
    const effectiveFilter = filter ?? {};
    const isAdmin = await this.hasPermission(user, 'recycle_bin_restore_any');
    if (!isAdmin) {
      const myAppUserId = await this.resolveAppUserId(user);
      effectiveFilter.ownerUserId = myAppUserId; // forza al proprio
    }
    return this.recycleBinService.list(effectiveFilter);
  }

  /**
   * Ripristina un elemento dal cestino.
   *
   * Autorizzazione:
   * - Owner del record (operatorId.appUserId === currentAppUserId) → OK.
   * - Admin con `recycle_bin_restore_any` → OK su qualunque record.
   */
  @Mutation(() => Boolean, { name: 'restoreFromRecycleBin' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('recycle_bin_view')
  async restore(
    @Args('entityType', { type: () => RecycleBinEntityType }) entityType: RecycleBinEntityType,
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: CurrentUserContext,
  ): Promise<boolean> {
    await this.requireOwnerOrPermission(
      entityType,
      id,
      user,
      'recycle_bin_restore_any',
    );
    return this.recycleBinService.restore(entityType, id);
  }

  /**
   * Eliminazione definitiva dal cestino. Riservata ad admin.
   */
  @Mutation(() => Boolean, { name: 'purgeFromRecycleBin' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('recycle_bin_purge')
  async purge(
    @Args('entityType', { type: () => RecycleBinEntityType }) entityType: RecycleBinEntityType,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.recycleBinService.purge(entityType, id);
  }

  /**
   * Svuota il cestino: applica retention oppure (force=true) elimina tutto.
   * Admin-only.
   */
  @Mutation(() => Int, { name: 'emptyRecycleBin' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('recycle_bin_purge')
  async empty(
    @Args('force', { type: () => Boolean, nullable: true, defaultValue: false })
    force: boolean,
  ): Promise<number> {
    return this.recycleBinService.runRetentionCleanup(force);
  }

  // ==================== SETTINGS ====================

  @Query(() => RecycleBinSettings, { name: 'recycleBinSettings' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('recycle_bin_view')
  async getSettings(): Promise<RecycleBinSettings> {
    return this.recycleBinService.getSettings();
  }

  @Mutation(() => RecycleBinSettings, { name: 'updateRecycleBinSettings' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('recycle_bin_settings_manage')
  async updateSettings(
    @Args('retentionDays', { type: () => Int, nullable: true })
    retentionDays: number | null,
    @CurrentUser() user: CurrentUserContext,
  ): Promise<RecycleBinSettings> {
    const updatedByUserId = await this.resolveAppUserId(user);
    return this.recycleBinService.updateSettings(retentionDays, updatedByUserId);
  }

  // ==================== HELPERS ====================

  private async resolveAppUserId(
    user: CurrentUserContext | undefined,
  ): Promise<string | undefined> {
    if (!user?.userId) return undefined;
    const appUser = await this.appUserService.findByKeycloakId(user.userId);
    return appUser?.id;
  }

  private async hasPermission(
    user: CurrentUserContext,
    permission: string,
  ): Promise<boolean> {
    const appUser = await this.appUserService.findByKeycloakId(user.userId);
    if (!appUser) return false;
    const perms = await this.appUserService.getUserPermissions(appUser.id);
    return perms.includes(permission);
  }

  /**
   * Verifica che il chiamante sia il proprietario del record (via
   * operatorId/primaryOperatorId → Operator.appUserId) oppure abbia il
   * permesso di bypass admin.
   */
  private async requireOwnerOrPermission(
    entityType: RecycleBinEntityType,
    id: string,
    user: CurrentUserContext,
    bypassPermission: string,
  ): Promise<void> {
    if (await this.hasPermission(user, bypassPermission)) return;

    const myAppUserId = await this.resolveAppUserId(user);
    if (!myAppUserId) {
      throw new ForbiddenException('AppUser non trovato per il chiamante.');
    }

    const ownerAppUserId = await this.resolveOwnerOf(entityType, id);
    if (ownerAppUserId !== myAppUserId) {
      throw new ForbiddenException(
        'Operazione consentita solo al proprietario del record o a un amministratore.',
      );
    }
  }

  private async resolveOwnerOf(
    entityType: RecycleBinEntityType,
    id: string,
  ): Promise<string | null> {
    if (entityType === RecycleBinEntityType.THERAPEUTIC_PATH) {
      const p = await this.pathRepo.findOne({
        where: { id, deletedAt: Not(IsNull()) } as any,
        withDeleted: true,
        select: ['id', 'primaryOperatorId'],
      });
      if (!p) throw new NotFoundException(`Percorso ${id} non trovato nel cestino`);
      return this.appUserIdOfOperator(p.primaryOperatorId);
    }
    if (entityType === RecycleBinEntityType.TREATMENT) {
      const t = await this.treatmentRepo.findOne({
        where: { id, deletedAt: Not(IsNull()) } as any,
        withDeleted: true,
        select: ['id', 'operatorId'],
      });
      if (!t) throw new NotFoundException(`Trattamento ${id} non trovato nel cestino`);
      return this.appUserIdOfOperator(t.operatorId);
    }
    // PATIENT_EVALUATION
    const e = await this.evaluationRepo.findOne({
      where: { id, deletedAt: Not(IsNull()) } as any,
      withDeleted: true,
      select: ['id', 'operatorId'],
    });
    if (!e) throw new NotFoundException(`Valutazione ${id} non trovata nel cestino`);
    return this.appUserIdOfOperator(e.operatorId);
  }

  private async appUserIdOfOperator(
    operatorId: string | null | undefined,
  ): Promise<string | null> {
    if (!operatorId) return null;
    const op = await this.operatorRepo.findOne({
      where: { id: operatorId },
      select: ['id', 'appUserId'],
    });
    return op?.appUserId ?? null;
  }
}
