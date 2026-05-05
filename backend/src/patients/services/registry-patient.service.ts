import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { RegistryClient } from '../../modules/registry/registry.client';
import {
  CreateIndividualDto,
  GlobalSearchRequest,
  RegistryRequestContext,
  RegistrySubjectResponse,
  UpdateIndividualDto,
  UpdatePrivacyConsentDto,
} from '../../modules/registry/registry.types';
import { ClinicalSubjectIndexService } from './clinical-subject-index.service';
import { CurrentUserContext } from '../../modules/users/decorators/current-user.decorator';
import { buildRegistryCtx } from '../../modules/registry/utils/build-registry-context';

/**
 * Orchestrator che combina chiamate al registry + sync della cache locale.
 *
 * Mantiene firme pulite: il caller passa il CurrentUserContext, lo service
 * costruisce internamente il RegistryRequestContext.
 */
@Injectable()
export class RegistryPatientService {
  private readonly logger = new Logger(RegistryPatientService.name);

  constructor(
    private readonly registry: RegistryClient,
    private readonly indexService: ClinicalSubjectIndexService,
  ) {}

  // ==================== READ ====================

  async getSubject(
    subjectId: string,
    user: CurrentUserContext,
  ): Promise<RegistrySubjectResponse | null> {
    const ctx = buildRegistryCtx(user);
    const subject = await this.registry.getSubject(subjectId, ctx);
    if (subject) {
      // Aggiorna best-effort la cache locale; errori non bloccano la lettura.
      await this.indexService.syncFromSubject(subject, user.orgId ?? user.orgAlias).catch((err) => {
        this.logger.warn(
          `Sync index fallita per ${subjectId}: ${(err as Error).message}`,
        );
      });
    }
    return subject;
  }

  async search(
    req: GlobalSearchRequest,
    user: CurrentUserContext,
  ): Promise<{
    data: RegistrySubjectResponse[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const ctx = buildRegistryCtx(user);
    const res = await this.registry.globalSearch(req, ctx);
    // Sync best-effort di tutti i subject che torniamo (riempie la cache).
    await Promise.allSettled(
      res.data.map((s) => this.indexService.syncFromSubject(s, user.orgId ?? user.orgAlias)),
    );
    return res;
  }

  // ==================== WRITE ====================

  async createIndividual(
    dto: CreateIndividualDto,
    user: CurrentUserContext,
  ): Promise<RegistrySubjectResponse> {
    const ctx = buildRegistryCtx(user);
    const subject = await this.registry.createIndividual(dto, ctx);
    await this.indexService.syncFromSubject(subject, user.orgId ?? user.orgAlias);
    return subject;
  }

  async updateIndividual(
    subjectId: string,
    dto: UpdateIndividualDto,
    user: CurrentUserContext,
  ): Promise<RegistrySubjectResponse> {
    const ctx = buildRegistryCtx(user);
    const subject = await this.registry.updateIndividual(subjectId, dto, ctx);
    await this.indexService.syncFromSubject(subject, user.orgId ?? user.orgAlias);
    return subject;
  }

  /**
   * Soft-delete via deactivate. L'endpoint REST è `PUT /individuals/:id`
   * con `isActive: false`.
   */
  async deactivate(
    subjectId: string,
    user: CurrentUserContext,
  ): Promise<RegistrySubjectResponse> {
    return this.updateIndividual(subjectId, { isActive: false }, user);
  }

  async updatePrivacyConsent(
    subjectId: string,
    dto: UpdatePrivacyConsentDto,
    user: CurrentUserContext,
  ) {
    const ctx = buildRegistryCtx(user);
    const consent = await this.registry.updatePrivacyConsent(subjectId, 'general', dto, ctx);
    // Refresh cache (il consenso non cambia display_name ma sblocca workflow)
    const fresh = await this.registry.getSubject(subjectId, ctx);
    if (fresh) {
      await this.indexService.syncFromSubject(fresh, user.orgId ?? user.orgAlias);
    } else {
      throw new NotFoundException(`Subject ${subjectId} non trovato dopo update consenso`);
    }
    return consent;
  }
}
