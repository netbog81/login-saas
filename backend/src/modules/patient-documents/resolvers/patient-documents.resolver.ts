import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  AuthorizationGuard,
  RequirePermissions,
} from '../../users/guards/authorization.guard';
import { PatientDocument } from '../entities/patient-document.entity';
import { PatientDocumentsService } from '../services/patient-documents.service';
import {
  PatientDocumentsFilterInput,
  PatientDocumentStats,
  UpdatePatientDocumentInput,
} from '../dto/patient-documents.dto';

/**
 * Metadati documenti paziente via GraphQL (elenco/filtri/stats/update/delete).
 * Il trasferimento binario (upload/download) è REST: PatientDocumentsController.
 */
@Resolver(() => PatientDocument)
export class PatientDocumentsResolver {
  constructor(private readonly documents: PatientDocumentsService) {}

  @Query(() => [PatientDocument], { name: 'patientDocuments' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('patient_read')
  async patientDocuments(
    @Args('subjectId', { type: () => ID }) subjectId: string,
    @Args('filter', { type: () => PatientDocumentsFilterInput, nullable: true })
    filter?: PatientDocumentsFilterInput,
  ): Promise<PatientDocument[]> {
    return this.documents.listDocuments(subjectId, filter);
  }

  @Query(() => PatientDocument, { name: 'patientDocument', nullable: true })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('patient_read')
  async patientDocument(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<PatientDocument | null> {
    return this.documents.getById(id);
  }

  @Query(() => PatientDocumentStats, { name: 'patientDocumentStats' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('patient_read')
  async patientDocumentStats(
    @Args('subjectId', { type: () => ID }) subjectId: string,
  ): Promise<PatientDocumentStats> {
    return this.documents.getStats(subjectId);
  }

  @Mutation(() => PatientDocument, { name: 'updatePatientDocument' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('patient_write')
  async updatePatientDocument(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdatePatientDocumentInput,
  ): Promise<PatientDocument> {
    return this.documents.updateDocument(id, input);
  }

  /** Soft delete: il documento va nel cestino (restore da recycle bin). */
  @Mutation(() => Boolean, { name: 'deletePatientDocument' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('patient_write')
  async deletePatientDocument(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.documents.softDeleteDocument(id);
  }
}
