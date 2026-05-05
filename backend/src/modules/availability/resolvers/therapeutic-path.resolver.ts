import { Resolver, Query, Mutation, Args, ID, ResolveField, Parent } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { TherapeuticPath } from '../entities/therapeutic-path.entity';
import { PathDocument, DocumentCategory } from '../entities/path-document.entity';
import { PatientModel } from '../../../patients/models/patient.model';
import { TherapeuticPathService } from '../services/therapeutic-path.service';
import {
  CreateTherapeuticPathInput,
  UpdateTherapeuticPathInput,
  CreateDocumentInput,
} from '../dto/therapeutic-path.input';
import {
  AuthorizationGuard,
  RequirePermissions,
} from '../../users/guards/authorization.guard';
import { AppUserService } from '../../users/services/app-user.service';
import {
  CurrentUser,
  CurrentUserContext,
} from '../../users/decorators/current-user.decorator';
import { OwnershipGuard, RequireOwnership } from '../guards/ownership.guard';

@Resolver(() => TherapeuticPath)
export class TherapeuticPathResolver {
  constructor(
    private readonly pathService: TherapeuticPathService,
    private readonly appUserService: AppUserService,
  ) {}

  private async resolveAppUserId(
    user: CurrentUserContext | undefined,
  ): Promise<string | undefined> {
    if (!user?.userId) return undefined;
    const appUser = await this.appUserService.findByKeycloakId(user.userId);
    return appUser?.id;
  }

  /**
   * ResolveField: shell `Patient { id }` da `patientId`. I campi del subject
   * (firstName, lastName, ecc.) vengono risolti dal PatientResolver via
   * RegistrySubjectLoader.
   */
  @ResolveField(() => PatientModel, { nullable: true })
  patient(@Parent() path: TherapeuticPath): PatientModel | null {
    if (!path.patientId) return null;
    return { id: path.patientId } as PatientModel;
  }

  // ==================== PATH QUERIES ====================

  /**
   * Query: Ottiene un percorso terapeutico per ID
   */
  @Query(() => TherapeuticPath, { name: 'therapeuticPath', nullable: true })
  async getTherapeuticPath(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<TherapeuticPath | null> {
    return this.pathService.findById(id);
  }

  /**
   * Query: Ottiene tutti i percorsi di un paziente
   */
  @Query(() => [TherapeuticPath], { name: 'therapeuticPathsByPatient' })
  async getTherapeuticPathsByPatient(
    @Args('patientId', { type: () => ID }) patientId: string,
  ): Promise<TherapeuticPath[]> {
    return this.pathService.findByPatient(patientId);
  }

  /**
   * Query batch: Ottiene tutti i percorsi per più pazienti in una sola query.
   */
  @Query(() => [TherapeuticPath], { name: 'therapeuticPathsByPatients' })
  async getTherapeuticPathsByPatients(
    @Args('patientIds', { type: () => [ID] }) patientIds: string[],
  ): Promise<TherapeuticPath[]> {
    return this.pathService.findByPatients(patientIds);
  }

  /**
   * Query: Ottiene i percorsi attivi di un paziente
   */
  @Query(() => [TherapeuticPath], { name: 'activeTherapeuticPathsByPatient' })
  async getActiveTherapeuticPathsByPatient(
    @Args('patientId', { type: () => ID }) patientId: string,
  ): Promise<TherapeuticPath[]> {
    return this.pathService.findActiveByPatient(patientId);
  }

  /**
   * Query: Ottiene i percorsi gestiti da un operatore
   */
  @Query(() => [TherapeuticPath], { name: 'therapeuticPathsByOperator' })
  async getTherapeuticPathsByOperator(
    @Args('operatorId', { type: () => ID }) operatorId: string,
  ): Promise<TherapeuticPath[]> {
    return this.pathService.findByOperator(operatorId);
  }

  // ==================== PATH MUTATIONS ====================

  /**
   * Mutation: Crea un nuovo percorso terapeutico
   */
  @Mutation(() => TherapeuticPath, { name: 'createTherapeuticPath' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('treatment_create')
  async createTherapeuticPath(
    @Args('input') input: CreateTherapeuticPathInput,
  ): Promise<TherapeuticPath> {
    return this.pathService.createPath(input);
  }

  /**
   * Mutation: Aggiorna un percorso terapeutico
   */
  @Mutation(() => TherapeuticPath, { name: 'updateTherapeuticPath' })
  @UseGuards(AuthorizationGuard, OwnershipGuard)
  @RequirePermissions('treatment_write')
  @RequireOwnership({ resource: 'therapeutic_path' })
  async updateTherapeuticPath(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateTherapeuticPathInput,
  ): Promise<TherapeuticPath> {
    return this.pathService.updatePath(id, input);
  }

  /**
   * Mutation: Elimina un percorso terapeutico
   */
  @Mutation(() => Boolean, { name: 'deleteTherapeuticPath' })
  @UseGuards(AuthorizationGuard, OwnershipGuard)
  @RequirePermissions('therapeutic_path_delete_own')
  @RequireOwnership({
    resource: 'therapeutic_path',
    bypassPermission: 'therapeutic_path_delete_any',
  })
  async deleteTherapeuticPath(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user?: CurrentUserContext,
  ): Promise<boolean> {
    const deletedByUserId = await this.resolveAppUserId(user);
    return this.pathService.deletePath(id, deletedByUserId);
  }

  // ==================== DOCUMENT QUERIES ====================

  /**
   * Query: Ottiene un documento per ID
   */
  @Query(() => PathDocument, { name: 'pathDocument', nullable: true })
  async getPathDocument(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<PathDocument | null> {
    return this.pathService.findDocumentById(id);
  }

  /**
   * Query: Ottiene i documenti di un percorso
   */
  @Query(() => [PathDocument], { name: 'documentsByPath' })
  async getDocumentsByPath(
    @Args('pathId', { type: () => ID }) pathId: string,
  ): Promise<PathDocument[]> {
    return this.pathService.findDocumentsByPath(pathId);
  }

  /**
   * Query: Ottiene i documenti di un percorso filtrati per categoria
   */
  @Query(() => [PathDocument], { name: 'documentsByPathAndCategory' })
  async getDocumentsByPathAndCategory(
    @Args('pathId', { type: () => ID }) pathId: string,
    @Args('category', { type: () => DocumentCategory }) category: DocumentCategory,
  ): Promise<PathDocument[]> {
    return this.pathService.findDocumentsByCategory(pathId, category);
  }

  // ==================== DOCUMENT MUTATIONS ====================

  /**
   * Mutation: Crea un nuovo documento
   */
  @Mutation(() => PathDocument, { name: 'createPathDocument' })
  async createPathDocument(
    @Args('input') input: CreateDocumentInput,
  ): Promise<PathDocument> {
    return this.pathService.createDocument(input);
  }

  /**
   * Mutation: Elimina un documento
   */
  @Mutation(() => Boolean, { name: 'deletePathDocument' })
  async deletePathDocument(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.pathService.deleteDocument(id);
  }
}
