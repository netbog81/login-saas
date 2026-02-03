import { Resolver, Query, Mutation, Args, ID, ObjectType, Field, Int } from '@nestjs/graphql';
import { PatientEvaluation } from '../entities/patient-evaluation.entity';
import { EvaluationObjective } from '../entities/evaluation-objective.entity';
import { EvaluationTest } from '../entities/evaluation-test.entity';
import { EvaluationExam } from '../entities/evaluation-exam.entity';
import { ObjectiveProgressHistory } from '../entities/objective-progress-history.entity';
import { TestEvaluationHistory } from '../entities/test-evaluation-history.entity';
import { PatientEvaluationService } from '../services/patient-evaluation.service';
import {
  CreateEvaluationInput,
  UpdateEvaluationInput,
  MarkObjectiveAchievedInput,
  UpdateTestResultInput,
  UpdateObjectiveProgressInput,
  AddTestEvaluationInput,
} from '../dto/patient-evaluation.input';

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

@Resolver(() => PatientEvaluation)
export class PatientEvaluationResolver {
  constructor(private readonly evaluationService: PatientEvaluationService) {}

  // ==================== EVALUATION QUERIES ====================

  /**
   * Query: Ottiene una valutazione per ID
   */
  @Query(() => PatientEvaluation, { name: 'patientEvaluation', nullable: true })
  async getPatientEvaluation(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<PatientEvaluation | null> {
    return this.evaluationService.findById(id);
  }

  /**
   * Query: Ottiene la valutazione di un percorso terapeutico
   */
  @Query(() => PatientEvaluation, { name: 'evaluationByPath', nullable: true })
  async getEvaluationByPath(
    @Args('pathId', { type: () => ID }) pathId: string,
  ): Promise<PatientEvaluation | null> {
    return this.evaluationService.findByTherapeuticPath(pathId);
  }

  // ==================== EVALUATION MUTATIONS ====================

  /**
   * Mutation: Crea una nuova valutazione
   */
  @Mutation(() => PatientEvaluation, { name: 'createEvaluation' })
  async createEvaluation(
    @Args('input') input: CreateEvaluationInput,
  ): Promise<PatientEvaluation> {
    return this.evaluationService.createEvaluation(input);
  }

  /**
   * Mutation: Aggiorna una valutazione esistente
   */
  @Mutation(() => PatientEvaluation, { name: 'updateEvaluation' })
  async updateEvaluation(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateEvaluationInput,
  ): Promise<PatientEvaluation> {
    return this.evaluationService.updateEvaluation(id, input);
  }

  /**
   * Mutation: Elimina una valutazione
   */
  @Mutation(() => Boolean, { name: 'deleteEvaluation' })
  async deleteEvaluation(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.evaluationService.deleteEvaluation(id);
  }

  // ==================== OBJECTIVE QUERIES ====================

  /**
   * Query: Ottiene gli obiettivi di una valutazione
   */
  @Query(() => [EvaluationObjective], { name: 'objectivesByEvaluation' })
  async getObjectivesByEvaluation(
    @Args('evaluationId', { type: () => ID }) evaluationId: string,
  ): Promise<EvaluationObjective[]> {
    return this.evaluationService.findObjectivesByEvaluation(evaluationId);
  }

  /**
   * Query: Ottiene il progresso degli obiettivi
   */
  @Query(() => ObjectivesProgress, { name: 'objectivesProgress' })
  async getObjectivesProgress(
    @Args('evaluationId', { type: () => ID }) evaluationId: string,
  ): Promise<ObjectivesProgress> {
    return this.evaluationService.getObjectivesProgress(evaluationId);
  }

  // ==================== OBJECTIVE MUTATIONS ====================

  /**
   * Mutation: Segna un obiettivo come raggiunto/non raggiunto
   * Usato nella sezione "Valutazione Trattamento"
   */
  @Mutation(() => EvaluationObjective, { name: 'markObjectiveAchieved' })
  async markObjectiveAchieved(
    @Args('objectiveId', { type: () => ID }) objectiveId: string,
    @Args('input') input: MarkObjectiveAchievedInput,
  ): Promise<EvaluationObjective> {
    return this.evaluationService.markObjectiveAchieved(objectiveId, input);
  }

  // ==================== TEST QUERIES ====================

  /**
   * Query: Ottiene i test di una valutazione
   */
  @Query(() => [EvaluationTest], { name: 'testsByEvaluation' })
  async getTestsByEvaluation(
    @Args('evaluationId', { type: () => ID }) evaluationId: string,
  ): Promise<EvaluationTest[]> {
    return this.evaluationService.findTestsByEvaluation(evaluationId);
  }

  /**
   * Query: Ottiene il progresso dei test
   */
  @Query(() => TestsProgress, { name: 'testsProgress' })
  async getTestsProgress(
    @Args('evaluationId', { type: () => ID }) evaluationId: string,
  ): Promise<TestsProgress> {
    return this.evaluationService.getTestsProgress(evaluationId);
  }

  // ==================== TEST MUTATIONS ====================

  /**
   * Mutation: Aggiorna il risultato di un test
   * Usato nella sezione "Valutazione Trattamento"
   */
  @Mutation(() => EvaluationTest, { name: 'updateTestResult' })
  async updateTestResult(
    @Args('testId', { type: () => ID }) testId: string,
    @Args('input') input: UpdateTestResultInput,
  ): Promise<EvaluationTest> {
    return this.evaluationService.updateTestResult(testId, input);
  }

  // ==================== EXAM QUERIES ====================

  /**
   * Query: Ottiene gli esami diagnostici di una valutazione
   */
  @Query(() => [EvaluationExam], { name: 'examsByEvaluation' })
  async getExamsByEvaluation(
    @Args('evaluationId', { type: () => ID }) evaluationId: string,
  ): Promise<EvaluationExam[]> {
    return this.evaluationService.findExamsByEvaluation(evaluationId);
  }

  // ==================== PROGRESS TRACKING (Tab Obiettivi) ====================

  /**
   * Query: Ottiene gli obiettivi con lo storico progressi
   */
  @Query(() => [EvaluationObjective], { name: 'objectivesWithHistory' })
  async getObjectivesWithHistory(
    @Args('evaluationId', { type: () => ID }) evaluationId: string,
  ): Promise<EvaluationObjective[]> {
    return this.evaluationService.getObjectivesWithHistory(evaluationId);
  }

  /**
   * Query: Ottiene i test con lo storico valutazioni
   */
  @Query(() => [EvaluationTest], { name: 'testsWithHistory' })
  async getTestsWithHistory(
    @Args('evaluationId', { type: () => ID }) evaluationId: string,
  ): Promise<EvaluationTest[]> {
    return this.evaluationService.getTestsWithHistory(evaluationId);
  }

  /**
   * Query: Ottiene lo storico progressi di un obiettivo
   */
  @Query(() => [ObjectiveProgressHistory], { name: 'objectiveProgressHistory' })
  async getObjectiveProgressHistory(
    @Args('objectiveId', { type: () => ID }) objectiveId: string,
  ): Promise<ObjectiveProgressHistory[]> {
    return this.evaluationService.getObjectiveProgressHistory(objectiveId);
  }

  /**
   * Query: Ottiene lo storico valutazioni di un test
   */
  @Query(() => [TestEvaluationHistory], { name: 'testEvaluationHistory' })
  async getTestEvaluationHistory(
    @Args('testId', { type: () => ID }) testId: string,
  ): Promise<TestEvaluationHistory[]> {
    return this.evaluationService.getTestEvaluationHistory(testId);
  }

  /**
   * Mutation: Aggiorna il progresso di un obiettivo (scala 0-5) con storico
   */
  @Mutation(() => EvaluationObjective, { name: 'updateObjectiveProgress' })
  async updateObjectiveProgress(
    @Args('objectiveId', { type: () => ID }) objectiveId: string,
    @Args('pathId', { type: () => ID }) pathId: string,
    @Args('operatorId', { type: () => ID }) operatorId: string,
    @Args('input') input: UpdateObjectiveProgressInput,
  ): Promise<EvaluationObjective> {
    return this.evaluationService.updateObjectiveProgress(objectiveId, input, operatorId, pathId);
  }

  /**
   * Mutation: Aggiunge una nuova valutazione a un test (ripetizione) con storico
   */
  @Mutation(() => EvaluationTest, { name: 'addTestEvaluation' })
  async addTestEvaluation(
    @Args('testId', { type: () => ID }) testId: string,
    @Args('pathId', { type: () => ID }) pathId: string,
    @Args('operatorId', { type: () => ID }) operatorId: string,
    @Args('input') input: AddTestEvaluationInput,
  ): Promise<EvaluationTest> {
    return this.evaluationService.addTestEvaluation(testId, input, operatorId, pathId);
  }

  /**
   * Mutation: Modifica l'ultima valutazione di un test (senza creare storico)
   */
  @Mutation(() => EvaluationTest, { name: 'editTestEvaluation' })
  async editTestEvaluation(
    @Args('testId', { type: () => ID }) testId: string,
    @Args('newLevel', { type: () => Int }) newLevel: number,
    @Args('operatorId', { type: () => ID }) operatorId: string,
  ): Promise<EvaluationTest> {
    return this.evaluationService.editTestEvaluation(testId, newLevel, operatorId);
  }

  /**
   * Mutation: Reset valutazione test (cancella storico e resetta a non valutato)
   */
  @Mutation(() => EvaluationTest, { name: 'resetTestEvaluation' })
  async resetTestEvaluation(
    @Args('testId', { type: () => ID }) testId: string,
  ): Promise<EvaluationTest> {
    return this.evaluationService.resetTestEvaluation(testId);
  }

  /**
   * Mutation: Elimina un test dalla valutazione
   * Controllo: deve restare almeno 1 test
   */
  @Mutation(() => Boolean, { name: 'deleteEvaluationTest' })
  async deleteEvaluationTest(
    @Args('testId', { type: () => ID }) testId: string,
    @Args('evaluationId', { type: () => ID }) evaluationId: string,
  ): Promise<boolean> {
    return this.evaluationService.deleteTest(testId, evaluationId);
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
    return this.evaluationService.editTestEvaluationEntry(evaluationHistoryId, {
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
    return this.evaluationService.deleteTestEvaluationEntry(evaluationHistoryId);
  }
}
