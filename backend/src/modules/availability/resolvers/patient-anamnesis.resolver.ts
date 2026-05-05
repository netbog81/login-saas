import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { PatientAnamnesis } from '../entities/patient-anamnesis.entity';
import { PatientAnamnesisService } from '../services/patient-anamnesis.service';
import {
  CreatePatientAnamnesisInput,
  UpdatePatientAnamnesisInput,
} from '../dto/patient-anamnesis.input';

/**
 * PatientAnamnesisResolver
 *
 * Resolver GraphQL per l'anamnesi del paziente.
 * Gestisce queries e mutations per CRUD anamnesi.
 */
@Resolver(() => PatientAnamnesis)
export class PatientAnamnesisResolver {
  constructor(private readonly anamnesisService: PatientAnamnesisService) {}

  // ==================== QUERIES ====================

  /**
   * Ottiene l'anamnesi per ID
   */
  @Query(() => PatientAnamnesis, { nullable: true, description: 'Ottiene anamnesi per ID' })
  async patientAnamnesis(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<PatientAnamnesis | null> {
    return this.anamnesisService.findById(id);
  }

  /**
   * Ottiene l'anamnesi di un paziente per subjectId.
   */
  @Query(() => PatientAnamnesis, { nullable: true, description: 'Ottiene anamnesi per subjectId' })
  async patientAnamnesisBySubject(
    @Args('subjectId', { type: () => ID }) subjectId: string,
  ): Promise<PatientAnamnesis | null> {
    return this.anamnesisService.findBySubjectId(subjectId);
  }

  /**
   * Verifica se un paziente ha un'anamnesi.
   */
  @Query(() => Boolean, { description: 'Verifica se il paziente ha un\'anamnesi' })
  async hasPatientAnamnesis(
    @Args('subjectId', { type: () => ID }) subjectId: string,
  ): Promise<boolean> {
    return this.anamnesisService.existsForSubject(subjectId);
  }

  // ==================== MUTATIONS ====================

  /**
   * Crea una nuova anamnesi per un paziente
   */
  @Mutation(() => PatientAnamnesis, { description: 'Crea nuova anamnesi paziente' })
  async createPatientAnamnesis(
    @Args('input') input: CreatePatientAnamnesisInput,
  ): Promise<PatientAnamnesis> {
    return this.anamnesisService.create(input);
  }

  /**
   * Aggiorna un'anamnesi esistente
   */
  @Mutation(() => PatientAnamnesis, { description: 'Aggiorna anamnesi paziente' })
  async updatePatientAnamnesis(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdatePatientAnamnesisInput,
  ): Promise<PatientAnamnesis> {
    return this.anamnesisService.update(id, input);
  }

  /**
   * Crea o aggiorna l'anamnesi di un paziente (upsert).
   */
  @Mutation(() => PatientAnamnesis, { description: 'Crea o aggiorna anamnesi paziente' })
  async upsertPatientAnamnesis(
    @Args('subjectId', { type: () => ID }) subjectId: string,
    @Args('input') input: UpdatePatientAnamnesisInput,
  ): Promise<PatientAnamnesis> {
    return this.anamnesisService.upsert(subjectId, input);
  }

  /**
   * Elimina un'anamnesi
   */
  @Mutation(() => Boolean, { description: 'Elimina anamnesi paziente' })
  async deletePatientAnamnesis(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.anamnesisService.delete(id);
  }
}
