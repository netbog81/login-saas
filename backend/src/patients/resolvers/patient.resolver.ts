import {
  Args,
  GraphQLISODateTime,
  ID,
  Mutation,
  ObjectType,
  Field,
  Int,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { ForbiddenException } from '@nestjs/common';

import { PatientModel } from '../models/patient.model';
import { AttendanceStatsModel } from '../models/attendance-stats.model';
import { PatientRelationshipModel } from '../models/patient-relationship.model';
import { RegistrySubjectModel } from '../../modules/registry/models/registry-subject.model';
import { PatientAnamnesis } from '../../modules/availability/entities/patient-anamnesis.entity';

import { CurrentUser, CurrentUserContext } from '../../modules/users/decorators/current-user.decorator';
import { SubjectLoader } from '../../modules/registry/decorators/subject-loader.decorator';
import { RegistrySubjectLoader } from '../../modules/registry/registry-subject.loader';
import { subjectResponseToModel } from '../../modules/registry/utils/subject-to-model.mapper';

import { RegistryPatientService } from '../services/registry-patient.service';
import { ClinicalSubjectIndexService } from '../services/clinical-subject-index.service';
import { ClinicalAttendanceService } from '../services/clinical-attendance.service';
import { PatientRelationshipService } from '../services/patient-relationship.service';
import { PatientAnamnesisService } from '../../modules/availability/services/patient-anamnesis.service';

import {
  CreatePatientInput,
  SearchPatientInput,
  CreatePatientRelationshipInput,
  UpsertRelationshipExtensionInput,
} from '../inputs';
import { UpdateRegistryIndividualInput } from '../inputs/create-registry-individual.input';
import { UpdatePatientAnamnesisInput } from '../../modules/availability/dto/patient-anamnesis.input';
import {
  CreateIndividualDto,
  SubjectType,
  Gender,
  GlobalSearchRequest,
  PrivacyConsentState,
  RegistrySubjectResponse,
  UpdateIndividualDto,
} from '../../modules/registry/registry.types';
import { AttendanceEventType } from '../entities/clinical-attendance-log.entity';

@ObjectType('PaginatedPatients')
class PaginatedPatients {
  @Field(() => [PatientModel])
  data: PatientModel[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  pageSize: number;

  @Field(() => Int)
  totalPages: number;
}

@Resolver(() => PatientModel)
export class PatientResolver {
  constructor(
    private readonly registryPatient: RegistryPatientService,
    private readonly indexService: ClinicalSubjectIndexService,
    private readonly attendanceService: ClinicalAttendanceService,
    private readonly relationshipService: PatientRelationshipService,
    private readonly anamnesisService: PatientAnamnesisService,
  ) {}

  // ==================== QUERIES ====================

  @Query(() => PatientModel, { nullable: true })
  async patient(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: CurrentUserContext,
  ): Promise<PatientModel | null> {
    const subject = await this.registryPatient.getSubject(id, user);
    if (!subject) return null;
    return this.toShell(id);
  }

  @Query(() => PaginatedPatients)
  async searchPatients(
    @Args('input') input: SearchPatientInput,
    @CurrentUser() user: CurrentUserContext,
  ): Promise<PaginatedPatients> {
    const req: GlobalSearchRequest = {
      query: input.query,
      subjectType: (input.subjectType as SubjectType) || 'INDIVIDUAL',
      isActive: input.isActive ?? true,
      privacyConsent: input.privacyConsent as PrivacyConsentState | undefined,
      page: input.page ?? 1,
      pageSize: input.pageSize ?? 25,
    };
    const res = await this.registryPatient.search(req, user);
    return {
      data: res.data.map((s) => this.toShell(s.id)),
      total: res.total,
      page: res.page,
      pageSize: res.pageSize,
      totalPages: res.totalPages,
    };
  }

  // ==================== MUTATIONS ====================

  @Mutation(() => PatientModel)
  async createPatient(
    @Args('input') input: CreatePatientInput,
    @CurrentUser() user: CurrentUserContext,
  ): Promise<PatientModel> {
    const dto: CreateIndividualDto = {
      firstName: input.registry.firstName,
      lastName: input.registry.lastName,
      taxCode: input.registry.taxCode,
      gender: input.registry.gender as Gender | undefined,
      birthDate: input.registry.birthDate,
      birthPlace: input.registry.birthPlace,
      birthCountry: input.registry.birthCountry,
      legalCapacity: input.registry.legalCapacity as CreateIndividualDto['legalCapacity'],
      vatNumber: input.registry.vatNumber,
      notes: input.registry.notes,
      addresses: input.registry.addresses?.map((a) => ({
        addressType: a.addressType as 'LEGAL' | 'RESIDENCE' | 'BILLING' | 'SHIPPING' | 'OTHER',
        street: a.street,
        city: a.city,
        zipCode: a.zipCode,
        province: a.province,
        countryCode: a.countryCode,
        isPrimary: a.isPrimary,
      })),
      contacts: input.registry.contacts?.map((c) => ({
        contactType: c.contactType as 'EMAIL' | 'PHONE' | 'MOBILE' | 'FAX' | 'PEC',
        value: c.value,
        label: c.label,
        isPrimary: c.isPrimary,
      })),
      roles: [{ roleType: 'PATIENT' }],
    };

    const subject = await this.registryPatient.createIndividual(dto, user);

    // Anamnesi opzionale all'atto di creazione
    if (input.anamnesis) {
      await this.anamnesisService.upsert(subject.id, input.anamnesis);
    }
    return this.toShell(subject.id);
  }

  @Mutation(() => PatientModel)
  async updatePatientRegistry(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateRegistryIndividualInput,
    @CurrentUser() user: CurrentUserContext,
  ): Promise<PatientModel> {
    const dto: UpdateIndividualDto = {
      firstName: input.firstName,
      lastName: input.lastName,
      taxCode: input.taxCode,
      gender: input.gender as Gender | undefined,
      birthDate: input.birthDate,
      birthPlace: input.birthPlace,
      birthCountry: input.birthCountry,
      legalCapacity: input.legalCapacity as UpdateIndividualDto['legalCapacity'],
      vatNumber: input.vatNumber,
      notes: input.notes,
      isActive: input.isActive,
      addresses: input.addresses?.map((a) => ({
        addressType: a.addressType as 'LEGAL' | 'RESIDENCE' | 'BILLING' | 'SHIPPING' | 'OTHER',
        street: a.street,
        city: a.city,
        zipCode: a.zipCode,
        province: a.province,
        countryCode: a.countryCode,
        isPrimary: a.isPrimary,
      })),
      contacts: input.contacts?.map((c) => ({
        contactType: c.contactType as 'EMAIL' | 'PHONE' | 'MOBILE' | 'FAX' | 'PEC',
        value: c.value,
        label: c.label,
        isPrimary: c.isPrimary,
      })),
    };
    await this.registryPatient.updateIndividual(id, dto, user);
    return this.toShell(id);
  }

  @Mutation(() => PatientAnamnesis)
  async updatePatientAnamnesis(
    @Args('subjectId', { type: () => ID }) subjectId: string,
    @Args('input') input: UpdatePatientAnamnesisInput,
  ): Promise<PatientAnamnesis> {
    return this.anamnesisService.upsert(subjectId, input);
  }

  @Mutation(() => PatientModel)
  async setPatientPrivacyConsent(
    @Args('id', { type: () => ID }) id: string,
    @Args('given') given: boolean,
    @Args('documentRef', { nullable: true }) documentRef: string | undefined,
    @CurrentUser() user: CurrentUserContext,
  ): Promise<PatientModel> {
    await this.registryPatient.updatePrivacyConsent(
      id,
      { given, documentRef },
      user,
    );
    return this.toShell(id);
  }

  @Mutation(() => Boolean)
  async deactivatePatient(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: CurrentUserContext,
  ): Promise<boolean> {
    await this.registryPatient.deactivate(id, user);
    return true;
  }

  @Mutation(() => Boolean)
  async recordPatientAttendance(
    @Args('subjectId', { type: () => ID }) subjectId: string,
    @Args('eventType', { type: () => String }) eventType: string,
    @Args('reason', { nullable: true }) reason: string | undefined,
    @Args('appointmentId', { type: () => ID, nullable: true }) appointmentId: string | undefined,
    @CurrentUser() user: CurrentUserContext,
  ): Promise<boolean> {
    if (eventType !== AttendanceEventType.NO_SHOW && eventType !== AttendanceEventType.CANCELLATION) {
      throw new ForbiddenException(`eventType non valido: ${eventType}`);
    }
    await this.attendanceService.recordEvent({
      subjectId,
      eventType: eventType as AttendanceEventType,
      reason,
      appointmentId,
      operatorId: user.userId,
    });
    return true;
  }

  // ==================== RELATIONSHIPS ====================

  @Mutation(() => Boolean)
  async createPatientRelationship(
    @Args('input') input: CreatePatientRelationshipInput,
    @CurrentUser() user: CurrentUserContext,
  ): Promise<boolean> {
    await this.relationshipService.createRelationship(
      {
        fromSubjectId: input.fromSubjectId,
        toSubjectId: input.toSubjectId,
        relationshipType: input.relationshipType,
        validFrom: input.validFrom,
        validTo: input.validTo,
      },
      user,
    );
    return true;
  }

  @Mutation(() => Boolean)
  async deletePatientRelationship(
    @Args('relationshipId', { type: () => ID }) relationshipId: string,
    @CurrentUser() user: CurrentUserContext,
  ): Promise<boolean> {
    await this.relationshipService.deleteRelationship(relationshipId, user);
    return true;
  }

  @Mutation(() => Boolean)
  async upsertPatientRelationshipExtension(
    @Args('input') input: UpsertRelationshipExtensionInput,
    @CurrentUser() user: CurrentUserContext,
  ): Promise<boolean> {
    await this.relationshipService.upsertExtension(
      input.registryRelationshipId,
      user.orgId,
      {
        isEmergencyContact: input.isEmergencyContact,
        isAuthorizedPickup: input.isAuthorizedPickup,
        isCaregiverDuringVisits: input.isCaregiverDuringVisits,
        notes: input.notes,
      },
    );
    return true;
  }

  // ==================== FIELD RESOLVERS ====================

  @ResolveField('subject', () => RegistrySubjectModel, { nullable: true })
  async resolveSubject(
    @Parent() patient: PatientModel,
    @SubjectLoader() loader: RegistrySubjectLoader,
  ): Promise<RegistrySubjectModel | null> {
    // Ritorna null per orphan reference (subject droppato o mai esistito).
    // Il frontend mostra placeholder "Paziente non disponibile" senza rompere
    // la query GraphQL.
    return loader.load(patient.id);
  }

  @ResolveField('anamnesis', () => PatientAnamnesis, { nullable: true })
  async resolveAnamnesis(@Parent() patient: PatientModel): Promise<PatientAnamnesis | null> {
    return this.anamnesisService.findBySubjectId(patient.id);
  }

  @ResolveField('attendance', () => AttendanceStatsModel)
  async resolveAttendance(@Parent() patient: PatientModel): Promise<AttendanceStatsModel> {
    return this.attendanceService.getStats(patient.id);
  }

  @ResolveField('relationships', () => [PatientRelationshipModel])
  async resolveRelationships(
    @Parent() patient: PatientModel,
    @SubjectLoader() loader: RegistrySubjectLoader,
    @CurrentUser() user: CurrentUserContext,
  ): Promise<PatientRelationshipModel[]> {
    const subject = await loader.load(patient.id);
    if (!subject) return [];

    const subjectResp = this.modelToSubjectResponse(subject);
    const { relationships, extensions } = await this.relationshipService.listForSubject(
      subjectResp,
      user,
    );

    return Promise.all(
      relationships.map(async (r) => {
        const otherModel = await loader.load(r.otherSubjectId);
        return {
          registryRelationshipId: r.registryRelationshipId,
          relationshipType: r.relationshipType,
          validFrom: r.validFrom,
          validTo: r.validTo,
          metadata: r.metadata,
          relatedSubject: otherModel as RegistrySubjectModel,
          extension: extensions.get(r.registryRelationshipId),
        };
      }),
    );
  }

  @ResolveField('displayName', () => String, { nullable: true })
  async resolveDisplayName(@Parent() patient: PatientModel): Promise<string | undefined> {
    const idx = await this.indexService.findOne(patient.id);
    return idx?.displayName ?? patient.displayName;
  }

  @ResolveField('isActive', () => Boolean, { nullable: true })
  async resolveIsActive(@Parent() patient: PatientModel): Promise<boolean | undefined> {
    const idx = await this.indexService.findOne(patient.id);
    return idx?.isActive;
  }

  @ResolveField('lastSyncedAt', () => GraphQLISODateTime, { nullable: true })
  async resolveLastSyncedAt(@Parent() patient: PatientModel): Promise<Date | undefined> {
    const idx = await this.indexService.findOne(patient.id);
    return idx?.lastSyncedAt;
  }

  // ==================== HELPERS ====================

  private toShell(id: string): PatientModel {
    return { id } as PatientModel;
  }

  /**
   * Inverso del mapper subject→model. Per il resolver `relationships` ci serve
   * un SubjectResponse "completo" da passare a PatientRelationshipService.
   */
  private modelToSubjectResponse(m: RegistrySubjectModel): RegistrySubjectResponse {
    return {
      id: m.id,
      subjectType: m.subjectType as SubjectType,
      isActive: m.isActive,
      notes: m.notes,
      firstName: m.firstName,
      lastName: m.lastName,
      gender: m.gender as RegistrySubjectResponse['gender'],
      birthDate: m.birthDate,
      birthPlace: m.birthPlace,
      birthCountry: m.birthCountry,
      taxCode: m.taxCode,
      legalCapacity: m.legalCapacity as RegistrySubjectResponse['legalCapacity'],
      legalName: m.legalName,
      organizationType: m.organizationType as RegistrySubjectResponse['organizationType'],
      sdiCode: m.sdiCode,
      pecEmail: m.pecEmail,
      vatNumber: m.vatNumber,
      roles: m.roles,
      addresses: m.addresses as unknown as RegistrySubjectResponse['addresses'],
      contacts: m.contacts as unknown as RegistrySubjectResponse['contacts'],
      privacyGeneralConsent: m.privacyGeneralConsent
        ? {
            given: m.privacyGeneralConsent.given,
            givenAt: m.privacyGeneralConsent.givenAt?.toISOString(),
            revokedAt: m.privacyGeneralConsent.revokedAt?.toISOString(),
            documentRef: m.privacyGeneralConsent.documentRef,
          }
        : undefined,
      outgoingRelationships: m.outgoingRelationships?.map((r) => ({
        id: r.id,
        relationshipType: r.relationshipType,
        validFrom: r.validFrom?.toISOString(),
        validTo: r.validTo?.toISOString(),
        metadata: r.metadata,
        otherSubjectId: r.otherSubjectId,
      })),
      incomingRelationships: m.incomingRelationships?.map((r) => ({
        id: r.id,
        relationshipType: r.relationshipType,
        validFrom: r.validFrom?.toISOString(),
        validTo: r.validTo?.toISOString(),
        metadata: r.metadata,
        otherSubjectId: r.otherSubjectId,
      })),
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    };
  }
}

// Esposto come export utility
export { PaginatedPatients };

// Helper per evitare uso variabile non riferito (TS strict)
void subjectResponseToModel;
