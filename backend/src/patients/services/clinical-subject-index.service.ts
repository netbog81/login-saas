import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { ClinicalSubjectIndex } from '../entities/clinical-subject-index.entity';
import { RegistrySubjectResponse } from '../../modules/registry/registry.types';

/**
 * CRUD su clinical_subject_index. È una cache di lookup: niente PII, solo
 * display_name + flag is_active/stale + organization_id.
 *
 * - Upsert lazy: chiamato la prima volta che un subject viene letto dal registry.
 * - Mark stale: chiamato dal consumer RabbitMQ (subject.updated/deactivated).
 * - Refresh: chiamato dopo fresh fetch dal registry (resetta stale=false).
 */
@Injectable()
export class ClinicalSubjectIndexService {
  private readonly logger = new Logger(ClinicalSubjectIndexService.name);

  constructor(
    @InjectRepository(ClinicalSubjectIndex)
    private readonly indexRepo: Repository<ClinicalSubjectIndex>,
  ) {}

  async findOne(subjectId: string): Promise<ClinicalSubjectIndex | null> {
    return this.indexRepo.findOne({ where: { subjectId } });
  }

  async findMany(subjectIds: string[]): Promise<ClinicalSubjectIndex[]> {
    if (subjectIds.length === 0) return [];
    return this.indexRepo.find({ where: { subjectId: In(subjectIds) } });
  }

  /**
   * Upsert dell'index a partire da un payload SubjectResponse.
   * Sincronizza display_name, is_active, last_synced_at; resetta stale=false.
   */
  async syncFromSubject(
    subject: RegistrySubjectResponse,
    organizationId: string,
  ): Promise<void> {
    const displayName = this.computeDisplayName(subject);
    const displayNameLower = displayName?.toLowerCase();

    await this.indexRepo
      .createQueryBuilder()
      .insert()
      .into(ClinicalSubjectIndex)
      .values({
        subjectId: subject.id,
        organizationId,
        displayName,
        displayNameLower,
        isActive: subject.isActive,
        stale: false,
        lastSyncedAt: new Date(),
      })
      .orUpdate(
        ['display_name', 'display_name_lower', 'is_active', 'stale', 'last_synced_at'],
        ['subject_id'],
      )
      .execute();
  }

  /**
   * Marca un subject come stale. Chiamato dal consumer RabbitMQ.
   * Se la riga non esiste (subject che il clinico non ha mai cachato), no-op.
   */
  async markStale(subjectId: string, isActive?: boolean): Promise<void> {
    const fields: Partial<ClinicalSubjectIndex> = { stale: true };
    if (typeof isActive === 'boolean') fields.isActive = isActive;
    const result = await this.indexRepo.update({ subjectId }, fields);
    if (result.affected === 0) {
      this.logger.debug(`markStale: subject ${subjectId} non in cache (skip)`);
    }
  }

  private computeDisplayName(s: RegistrySubjectResponse): string | undefined {
    if (s.subjectType === 'INDIVIDUAL') {
      return [s.firstName, s.lastName].filter(Boolean).join(' ').trim() || undefined;
    }
    return s.legalName;
  }
}
