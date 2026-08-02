import { Resolver, Query, Mutation, Args, ID, ResolveField, Parent } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { TherapeuticPath } from '../entities/therapeutic-path.entity';
import { PatientModel } from '../../../patients/models/patient.model';
import { TherapeuticPathService } from '../services/therapeutic-path.service';
import {
  CreateTherapeuticPathInput,
  UpdateTherapeuticPathInput,
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
   * Mutation: Aggiorna un percorso terapeutico.
   *
   * NESSUN OwnershipGuard: il percorso terapeutico è gestibile da tutta la
   * categoria (operatori + istruttori), non solo dal creatore. Un paziente
   * può essere seguito da più terapisti sullo stesso percorso, quindi
   * chiunque abbia `treatment_write` può modificarlo. L'ownership stretto
   * resta solo sul Treatment (gestibile dal proprio operatore).
   */
  @Mutation(() => TherapeuticPath, { name: 'updateTherapeuticPath' })
  @UseGuards(AuthorizationGuard)
  @RequirePermissions('treatment_write')
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

  // NOTA: le query/mutation documenti (pathDocument, documentsByPath,
  // createPathDocument, ...) sono state sostituite dal modulo
  // patient-documents (entity patient_documents, storage S3 cifrato).
}
