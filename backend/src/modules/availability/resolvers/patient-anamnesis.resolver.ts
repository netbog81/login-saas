import { Resolver, Query, Mutation, Args, ID, ObjectType, Field, Int } from '@nestjs/graphql';
import { PatientAnamnesis } from '../entities/patient-anamnesis.entity';
import { AnamnesisObjective } from '../entities/anamnesis-objective.entity';
import { AnamnesisTest } from '../entities/anamnesis-test.entity';
import { AnamnesisExam } from '../entities/anamnesis-exam.entity';
import { ObjectiveProgressHistory } from '../entities/objective-progress-history.entity';
import { TestEvaluationHistory } from '../entities/test-evaluation-history.entity';
import { PatientAnamnesisService } from '../services/patient-anamnesis.service';
import {
  CreateAnamnesisInput,
  UpdateAnamnesisInput,
  MarkObjectiveAchievedInput,
  UpdateTestResultInput,
  UpdateObjectiveProgressInput,
  AddTestEvaluationInput,
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

  // ==================== PROGRESS TRACKING (Tab Obiettivi) ====================

  /**
   * Query: Ottiene gli obiettivi con lo storico progressi
   */
  @Query(() => [AnamnesisObjective], { name: 'objectivesWithHistory' })
  async getObjectivesWithHistory(
    @Args('anamnesisId', { type: () => ID }) anamnesisId: string,
  ): Promise<AnamnesisObjective[]> {
    return this.anamnesisService.getObjectivesWithHistory(anamnesisId);
  }

  /**
   * Query: Ottiene i test con lo storico valutazioni
   */
  @Query(() => [AnamnesisTest], { name: 'testsWithHistory' })
  async getTestsWithHistory(
    @Args('anamnesisId', { type: () => ID }) anamnesisId: string,
  ): Promise<AnamnesisTest[]> {
    return this.anamnesisService.getTestsWithHistory(anamnesisId);
  }

  /**
   * Query: Ottiene lo storico progressi di un obiettivo
   */
  @Query(() => [ObjectiveProgressHistory], { name: 'objectiveProgressHistory' })
  async getObjectiveProgressHistory(
    @Args('objectiveId', { type: () => ID }) objectiveId: string,
  ): Promise<ObjectiveProgressHistory[]> {
    return this.anamnesisService.getObjectiveProgressHistory(objectiveId);
  }

  /**
   * Query: Ottiene lo storico valutazioni di un test
   */
  @Query(() => [TestEvaluationHistory], { name: 'testEvaluationHistory' })
  async getTestEvaluationHistory(
    @Args('testId', { type: () => ID }) testId: string,
  ): Promise<TestEvaluationHistory[]> {
    return this.anamnesisService.getTestEvaluationHistory(testId);
  }

  /**
   * Mutation: Aggiorna il progresso di un obiettivo (scala 0-5) con storico
   */
  @Mutation(() => AnamnesisObjective, { name: 'updateObjectiveProgress' })
  async updateObjectiveProgress(
    @Args('objectiveId', { type: () => ID }) objectiveId: string,
    @Args('pathId', { type: () => ID }) pathId: string,
    @Args('operatorId', { type: () => ID }) operatorId: string,
    @Args('input') input: UpdateObjectiveProgressInput,
  ): Promise<AnamnesisObjective> {
    return this.anamnesisService.updateObjectiveProgress(objectiveId, input, operatorId, pathId);
  }

  /**
   * Mutation: Aggiunge una nuova valutazione a un test (ripetizione) con storico
   */
  @Mutation(() => AnamnesisTest, { name: 'addTestEvaluation' })
  async addTestEvaluation(
    @Args('testId', { type: () => ID }) testId: string,
    @Args('pathId', { type: () => ID }) pathId: string,
    @Args('operatorId', { type: () => ID }) operatorId: string,
    @Args('input') input: AddTestEvaluationInput,
  ): Promise<AnamnesisTest> {
    return this.anamnesisService.addTestEvaluation(testId, input, operatorId, pathId);
  }

  /**
   * Mutation: Modifica l'ultima valutazione di un test (senza creare storico)
   */
  @Mutation(() => AnamnesisTest, { name: 'editTestEvaluation' })
  async editTestEvaluation(
    @Args('testId', { type: () => ID }) testId: string,
    @Args('newLevel', { type: () => Int }) newLevel: number,
    @Args('operatorId', { type: () => ID }) operatorId: string,
  ): Promise<AnamnesisTest> {
    return this.anamnesisService.editTestEvaluation(testId, newLevel, operatorId);
  }

  /**
   * Mutation: Reset valutazione test (cancella storico e resetta a non valutato)
   */
  @Mutation(() => AnamnesisTest, { name: 'resetTestEvaluation' })
  async resetTestEvaluation(
    @Args('testId', { type: () => ID }) testId: string,
  ): Promise<AnamnesisTest> {
    return this.anamnesisService.resetTestEvaluation(testId);
  }

  /**
   * Mutation: Elimina un test dall'anamnesi
   * Controllo: deve restare almeno 1 test
   */
  @Mutation(() => Boolean, { name: 'deleteAnamnesisTest' })
  async deleteAnamnesisTest(
    @Args('testId', { type: () => ID }) testId: string,
    @Args('anamnesisId', { type: () => ID }) anamnesisId: string,
  ): Promise<boolean> {
    return this.anamnesisService.deleteTest(testId, anamnesisId);
  }

  /**
   * Mutation: Modifica una singola entry dello storico valutazioni test
   */
  @Mutation(() => TestEvaluationHistory, { name: 'editTestEvaluationEntry' })
  async editTestEvaluationEntry(
    @Args('evaluationHistoryId', { type: () => ID }) evaluationHistoryId: string,
    @Args('evaluationLevel', { type: () => Int }) evaluationLevel: number,
    @Args('note', { nullable: true }) note?: string,
  ): Promise<TestEvaluationHistory> {
    return this.anamnesisService.editTestEvaluationEntry(evaluationHistoryId, {
      evaluationLevel,
      note
    });
  }

  /**
   * Mutation: Elimina una singola entry dello storico valutazioni test
   * Non permette di eliminare se è l'unica valutazione
   */
  @Mutation(() => Boolean, { name: 'deleteTestEvaluationEntry' })
  async deleteTestEvaluationEntry(
    @Args('evaluationHistoryId', { type: () => ID }) evaluationHistoryId: string,
  ): Promise<boolean> {
    return this.anamnesisService.deleteTestEvaluationEntry(evaluationHistoryId);
  }
}
