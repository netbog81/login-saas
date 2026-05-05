import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { ClinicalRelationshipExtension } from '../entities/clinical-relationship-extension.entity';
import { RegistryClient } from '../../modules/registry/registry.client';
import {
  CreateRelationshipDto,
  RegistryRelationshipResponse,
  RegistrySubjectResponse,
} from '../../modules/registry/registry.types';
import { CurrentUserContext } from '../../modules/users/decorators/current-user.decorator';
import { buildRegistryCtx } from '../../modules/registry/utils/build-registry-context';

/**
 * Composizione del modello PatientRelationship: prende le relazioni dal
 * registry (autoritativo per il tipo + i due estremi), e fa LEFT JOIN
 * con clinical_relationship_extension per i flag operativi clinici.
 */
@Injectable()
export class PatientRelationshipService {
  constructor(
    @InjectRepository(ClinicalRelationshipExtension)
    private readonly extRepo: Repository<ClinicalRelationshipExtension>,
    private readonly registry: RegistryClient,
  ) {}

  /**
   * Costruisce le relazioni di un paziente partendo da un SubjectResponse
   * già caricato (outgoing+incoming sono inclusi nel payload).
   * Se il SubjectResponse non ha le relationships, le carica via REST.
   */
  async listForSubject(
    subject: RegistrySubjectResponse,
    user: CurrentUserContext,
  ): Promise<{
    relationships: Array<{
      registryRelationshipId: string;
      relationshipType: string;
      validFrom?: Date;
      validTo?: Date;
      metadata?: Record<string, unknown>;
      otherSubjectId: string;
    }>;
    extensions: Map<string, ClinicalRelationshipExtension>;
  }> {
    const merged: Array<{
      registryRelationshipId: string;
      relationshipType: string;
      validFrom?: Date;
      validTo?: Date;
      metadata?: Record<string, unknown>;
      otherSubjectId: string;
    }> = [];

    const collect = (
      list: RegistrySubjectResponse['outgoingRelationships'] | undefined,
    ) => {
      for (const r of list || []) {
        merged.push({
          registryRelationshipId: r.id,
          relationshipType: r.relationshipType,
          validFrom: r.validFrom ? new Date(r.validFrom) : undefined,
          validTo: r.validTo ? new Date(r.validTo) : undefined,
          metadata: r.metadata,
          otherSubjectId: r.otherSubjectId,
        });
      }
    };
    collect(subject.outgoingRelationships);
    collect(subject.incomingRelationships);

    // Fallback: se il subject non ha le liste embedded, le prende dall'endpoint dedicato
    if (
      !subject.outgoingRelationships &&
      !subject.incomingRelationships
    ) {
      const ctx = buildRegistryCtx(user);
      const list = await this.registry.getSubjectRelationships(subject.id, ctx);
      for (const r of list) {
        const otherSubjectId = r.fromSubjectId === subject.id ? r.toSubjectId : r.fromSubjectId;
        merged.push({
          registryRelationshipId: r.id,
          relationshipType: r.relationshipType,
          validFrom: r.validFrom ? new Date(r.validFrom) : undefined,
          validTo: r.validTo ? new Date(r.validTo) : undefined,
          metadata: r.metadata,
          otherSubjectId,
        });
      }
    }

    // Carica le extension locali per gli id presenti
    const ids = merged.map((m) => m.registryRelationshipId);
    const extensions = ids.length
      ? await this.extRepo.find({ where: { registryRelationshipId: In(ids) } })
      : [];
    const extMap = new Map<string, ClinicalRelationshipExtension>();
    for (const e of extensions) extMap.set(e.registryRelationshipId, e);

    return { relationships: merged, extensions: extMap };
  }

  // ==================== MUTATIONS ====================

  async createRelationship(
    dto: CreateRelationshipDto,
    user: CurrentUserContext,
  ): Promise<RegistryRelationshipResponse> {
    const ctx = buildRegistryCtx(user);
    return this.registry.createRelationship(dto, ctx);
  }

  async closeRelationship(
    relationshipId: string,
    validTo: string,
    user: CurrentUserContext,
  ): Promise<RegistryRelationshipResponse> {
    const ctx = buildRegistryCtx(user);
    return this.registry.closeRelationship(relationshipId, validTo, ctx);
  }

  async deleteRelationship(relationshipId: string, user: CurrentUserContext): Promise<void> {
    const ctx = buildRegistryCtx(user);
    await this.registry.deleteRelationship(relationshipId, ctx);
    // Cleanup extension locale (se presente)
    await this.extRepo.delete({ registryRelationshipId: relationshipId });
  }

  /**
   * Upsert dei flag operativi clinici per una relationship esistente nel registry.
   */
  async upsertExtension(
    registryRelationshipId: string,
    organizationId: string,
    flags: {
      isEmergencyContact?: boolean;
      isAuthorizedPickup?: boolean;
      isCaregiverDuringVisits?: boolean;
      notes?: string | null;
    },
  ): Promise<ClinicalRelationshipExtension> {
    const existing = await this.extRepo.findOne({ where: { registryRelationshipId } });
    if (existing) {
      if (flags.isEmergencyContact !== undefined)
        existing.isEmergencyContact = flags.isEmergencyContact;
      if (flags.isAuthorizedPickup !== undefined)
        existing.isAuthorizedPickup = flags.isAuthorizedPickup;
      if (flags.isCaregiverDuringVisits !== undefined)
        existing.isCaregiverDuringVisits = flags.isCaregiverDuringVisits;
      if (flags.notes !== undefined) existing.notes = flags.notes ?? undefined;
      return this.extRepo.save(existing);
    }
    const created = this.extRepo.create({
      registryRelationshipId,
      organizationId,
      isEmergencyContact: flags.isEmergencyContact ?? false,
      isAuthorizedPickup: flags.isAuthorizedPickup ?? false,
      isCaregiverDuringVisits: flags.isCaregiverDuringVisits ?? false,
      notes: flags.notes ?? undefined,
    });
    return this.extRepo.save(created);
  }
}
