import { Resolver, Query, Mutation, Args, ID, ObjectType, Field, Int } from '@nestjs/graphql';
import { PatientAnamnesis } from '../entities/patient-anamnesis.entity';
import { AnamnesisObjective } from '../entities/anamnesis-objective.entity';
import { AnamnesisTest } from '../entities/anamnesis-test.entity';
import { AnamnesisExam } from '../entities/anamnesis-exam.entity';
import { PatientAnamnesisService } from '../services/patient-anamnesis.service';
import {
  CreateAnamnesisInput,
  UpdateAnamnesisInput,
  MarkObjectiveAchievedInput,
  UpdateTestResultInput,
} from '../dto/patient-anamnesis.input';

// ==================== RESPONSE TYPES ====================

@ObjectType('ObjectivesProgress')
class ObjectivesProgress {
  @Field(() => Int)
  total: number;

  @Field(() => Int)
  achieved: number;

  @Field(() => Int)
  percentage: number;
}

@ObjectType('TestsProgress')
class TestsProgress {
  @Field(() => Int)
  total: number;

  @Field(() => Int)
  passed: number;

  @Field(() => Int)
  failed: number;

  @Field(() => Int)
  pending: number;

  @Field(() => Int)
  percentage: number;
}

// ==================== RESOLVER ====================

@Resolver(() => PatientAnamnesis)
export class PatientAnamnesisResolver {
  constructor(private readonly anamnesisService: PatientAnamnesisService) {}

  // ==================== ANAMNESIS QUERIES ====================

  /**
   * Query: Ottiene un'anamnesi per ID
   */
  @Query(() => PatientAnamnesis, { name: 'patientAnamnesis', nullable: true })
  async getPatientAnamnesis(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<PatientAnamnesis | null> {
    return this.anamnesisService.findById(id);
  }

  /**
   * Query: Ottiene l'anamnesi di un percorso terapeutico
   */
  @Query(() => PatientAnamnesis, { name: 'anamnesisByPath', nullable: true })
  async getAnamnesisByPath(
    @Args('pathId', { type: () => ID }) pathId: string,
  ): Promise<PatientAnamnesis | null> {
    return this.anamnesisService.findByTherapeuticPath(pathId);
  }

  // ==================== ANAMNESIS MUTATIONS ====================

  /**
   * Mutation: Crea una nuova anamnesi
   */
  @Mutation(() => PatientAnamnesis, { name: 'createAnamnesis' })
  async createAnamnesis(
    @Args('input') input: CreateAnamnesisInput,
  ): Promise<PatientAnamnesis> {
    return this.anamnesisService.createAnamnesis(input);
  }

  /**
   * Mutation: Aggiorna un'anamnesi esistente
   */
  @Mutation(() => PatientAnamnesis, { name: 'updateAnamnesis' })
  async updateAnamnesis(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateAnamnesisInput,
  ): Promise<PatientAnamnesis> {
    return this.anamnesisService.updateAnamnesis(id, input);
  }

  /**
   * Mutation: Elimina un'anamnesi
   */
  @Mutation(() => Boolean, { name: 'deleteAnamnesis' })
  async deleteAnamnesis(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.anamnesisService.deleteAnamnesis(id);
  }

  // ==================== OBJECTIVE QUERIES ====================

  /**
   * Query: Ottiene gli obiettivi di un'anamnesi
   */
  @Query(() => [AnamnesisObjective], { name: 'objectivesByAnamnesis' })
  async getObjectivesByAnamnesis(
    @Args('anamnesisId', { type: () => ID }) anamnesisId: string,
  ): Promise<AnamnesisObjective[]> {
    return this.anamnesisService.findObjectivesByAnamnesis(anamnesisId);
  }

  /**
   * Query: Ottiene il progresso degli obiettivi
   */
  @Query(() => ObjectivesProgress, { name: 'objectivesProgress' })
  async getObjectivesProgress(
    @Args('anamnesisId', { type: () => ID }) anamnesisId: string,
  ): Promise<ObjectivesProgress> {
    return this.anamnesisService.getObjectivesProgress(anamnesisId);
  }

  // ==================== OBJECTIVE MUTATIONS ====================

  /**
   * Mutation: Segna un obiettivo come raggiunto/non raggiunto
   * Usato nella sezione "Valutazione Trattamento"
   */
  @Mutation(() => AnamnesisObjective, { name: 'markObjectiveAchieved' })
  async markObjectiveAchieved(
    @Args('objectiveId', { type: () => ID }) objectiveId: string,
    @Args('input') input: MarkObjectiveAchievedInput,
  ): Promise<AnamnesisObjective> {
    return this.anamnesisService.markObjectiveAchieved(objectiveId, input);
  }

  // ==================== TEST QUERIES ====================

  /**
   * Query: Ottiene i test di un'anamnesi
   */
  @Query(() => [AnamnesisTest], { name: 'testsByAnamnesis' })
  async getTestsByAnamnesis(
    @Args('anamnesisId', { type: () => ID }) anamnesisId: string,
  ): Promise<AnamnesisTest[]> {
    return this.anamnesisService.findTestsByAnamnesis(anamnesisId);
  }

  /**
   * Query: Ottiene il progresso dei test
   */
  @Query(() => TestsProgress, { name: 'testsProgress' })
  async getTestsProgress(
    @Args('anamnesisId', { type: () => ID }) anamnesisId: string,
  ): Promise<TestsProgress> {
    return this.anamnesisService.getTestsProgress(anamnesisId);
  }

  // ==================== TEST MUTATIONS ====================

  /**
   * Mutation: Aggiorna il risultato di un test
   * Usato nella sezione "Valutazione Trattamento"
   */
  @Mutation(() => AnamnesisTest, { name: 'updateTestResult' })
  async updateTestResult(
    @Args('testId', { type: () => ID }) testId: string,
    @Args('input') input: UpdateTestResultInput,
  ): Promise<AnamnesisTest> {
    return this.anamnesisService.updateTestResult(testId, input);
  }

  // ==================== EXAM QUERIES ====================

  /**
   * Query: Ottiene gli esami diagnostici di un'anamnesi
   */
  @Query(() => [AnamnesisExam], { name: 'examsByAnamnesis' })
  async getExamsByAnamnesis(
    @Args('anamnesisId', { type: () => ID }) anamnesisId: string,
  ): Promise<AnamnesisExam[]> {
    return this.anamnesisService.findExamsByAnamnesis(anamnesisId);
  }
}
