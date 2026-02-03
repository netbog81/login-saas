import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, MoreThan } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { PatientEvaluation } from '../entities/patient-evaluation.entity';
import { EvaluationObjective } from '../entities/evaluation-objective.entity';
import { EvaluationTest } from '../entities/evaluation-test.entity';
import { EvaluationExam } from '../entities/evaluation-exam.entity';
import { ObjectiveProgressHistory } from '../entities/objective-progress-history.entity';
import { TestEvaluationHistory } from '../entities/test-evaluation-history.entity';
import { TherapeuticPath } from '../entities/therapeutic-path.entity';
import { Treatment, TreatmentStatus } from '../entities/treatment.entity';
import {
  CreateEvaluationInput,
  UpdateEvaluationInput,
  EvaluationObjectiveInput,
  EvaluationTestInput,
  EvaluationExamInput,
  MarkObjectiveAchievedInput,
  UpdateTestResultInput,
  UpdateObjectiveProgressInput,
  AddTestEvaluationInput
} from '../dto/patient-evaluation.input';

@Injectable()
export class PatientEvaluationService {
  constructor(
    @InjectRepository(PatientEvaluation)
    private evaluationRepo: Repository<PatientEvaluation>,
    @InjectRepository(EvaluationObjective)
    private objectiveRepo: Repository<EvaluationObjective>,
    @InjectRepository(EvaluationTest)
    private testRepo: Repository<EvaluationTest>,
    @InjectRepository(EvaluationExam)
    private examRepo: Repository<EvaluationExam>,
    @InjectRepository(TherapeuticPath)
    private pathRepo: Repository<TherapeuticPath>,
    @InjectRepository(ObjectiveProgressHistory)
    private objectiveProgressHistoryRepo: Repository<ObjectiveProgressHistory>,
    @InjectRepository(TestEvaluationHistory)
    private testEvaluationHistoryRepo: Repository<TestEvaluationHistory>,
    @InjectRepository(Treatment)
    private treatmentRepo: Repository<Treatment>,
    private dataSource: DataSource,
  ) {}

  // ==================== HELPERS ====================

  /**
   * Genera UUID per i marker senza ID
   * I bodyMapMarkers sono salvati come JSONB, non come entità separate
   */
  private processBodyMapMarkers(
    markers?: Array<{ id?: string; x: number; y: number; note?: string }>
  ): Array<{ id: string; x: number; y: number; note?: string }> | undefined {
    if (!markers) return undefined;
    return markers.map(m => ({
      ...m,
      id: m.id || uuidv4()
    }));
  }

  // ==================== EVALUATION CRUD ====================

  /**
   * Crea una nuova valutazione per un percorso terapeutico
   * Relazione 1:1 con TherapeuticPath
   */
  async createEvaluation(input: CreateEvaluationInput): Promise<PatientEvaluation> {
    // Verifica che il percorso esista
    const path = await this.pathRepo.findOne({
      where: { id: input.therapeuticPathId }
    });

    if (!path) {
      throw new NotFoundException(`Percorso terapeutico ${input.therapeuticPathId} non trovato`);
    }

    // Verifica che non esista già una valutazione per questo percorso
    const existingEvaluation = await this.evaluationRepo.findOne({
      where: { therapeuticPathId: input.therapeuticPathId }
    });

    if (existingEvaluation) {
      throw new BadRequestException(
        `Esiste già una valutazione per il percorso ${input.therapeuticPathId}. Usa updateEvaluation per modificarla.`
      );
    }

    // Usa transazione per creare valutazione + relazioni
    return this.dataSource.transaction(async (manager) => {
      // Estrai gli array per le entità correlate
      const { objectives, tests, exams, ...evaluationData } = input;

      // Crea la valutazione principale
      // Processa i bodyMapMarkers per generare UUID ai nuovi marker
      const evaluation = manager.create(PatientEvaluation, {
        ...evaluationData,
        bodyMapMarkers: this.processBodyMapMarkers(evaluationData.bodyMapMarkers)
      });
      const savedEvaluation = await manager.save(PatientEvaluation, evaluation);

      // Crea gli obiettivi se presenti
      if (objectives && objectives.length > 0) {
        const objectiveEntities = objectives.map((obj, index) =>
          manager.create(EvaluationObjective, {
            ...obj,
            evaluationId: savedEvaluation.id,
            orderIndex: obj.orderIndex ?? index
          })
        );
        await manager.save(EvaluationObjective, objectiveEntities);
      }

      // Crea i test se presenti
      if (tests && tests.length > 0) {
        const testEntities = tests.map((test, index) =>
          manager.create(EvaluationTest, {
            ...test,
            evaluationId: savedEvaluation.id,
            orderIndex: test.orderIndex ?? index
          })
        );
        await manager.save(EvaluationTest, testEntities);
      }

      // Crea gli esami se presenti
      if (exams && exams.length > 0) {
        const examEntities = exams.map((exam, index) =>
          manager.create(EvaluationExam, {
            ...exam,
            evaluationId: savedEvaluation.id,
            orderIndex: exam.orderIndex ?? index
          })
        );
        await manager.save(EvaluationExam, examEntities);
      }

      // Ricarica la valutazione con tutte le relazioni usando il manager della transazione
      const reloadedEvaluation = await manager.findOne(PatientEvaluation, {
        where: { id: savedEvaluation.id },
        relations: ['therapeuticPath', 'operator', 'objectives', 'tests', 'exams']
      });

      if (!reloadedEvaluation) {
        throw new Error(`Impossibile ricaricare la valutazione appena creata con ID ${savedEvaluation.id}`);
      }

      return reloadedEvaluation;
    });
  }

  /**
   * Ottiene una valutazione per ID con tutte le relazioni
   */
  async findById(id: string): Promise<PatientEvaluation | null> {
    return this.evaluationRepo.findOne({
      where: { id },
      relations: [
        'therapeuticPath',
        'operator',
        'objectives',
        'tests',
        'tests.evaluationHistory',
        'tests.evaluationHistory.operator',
        'exams'
      ]
    });
  }

  /**
   * Ottiene la valutazione di un percorso terapeutico
   */
  async findByTherapeuticPath(pathId: string): Promise<PatientEvaluation | null> {
    return this.evaluationRepo.findOne({
      where: { therapeuticPathId: pathId },
      relations: [
        'therapeuticPath',
        'operator',
        'objectives',
        'tests',
        'tests.evaluationHistory',
        'tests.evaluationHistory.operator',
        'exams'
      ]
    });
  }

  /**
   * Aggiorna una valutazione esistente
   * Gestisce sia i campi scalari che le collezioni (objectives, tests, exams)
   */
  async updateEvaluation(id: string, input: UpdateEvaluationInput): Promise<PatientEvaluation> {
    const evaluation = await this.findById(id);

    if (!evaluation) {
      throw new NotFoundException(`Valutazione ${id} non trovata`);
    }

    return this.dataSource.transaction(async (manager) => {
      const { objectives, tests, exams, ...scalarFields } = input;

      // Aggiorna i campi scalari
      if (Object.keys(scalarFields).length > 0) {
        // Processa i bodyMapMarkers per generare UUID ai nuovi marker
        if (scalarFields.bodyMapMarkers) {
          (scalarFields as any).bodyMapMarkers = this.processBodyMapMarkers(scalarFields.bodyMapMarkers);
        }
        Object.assign(evaluation, scalarFields);
        await manager.save(PatientEvaluation, evaluation);
      }

      // Se sono forniti objectives, gestisci update/create/delete
      if (objectives !== undefined) {
        await this.syncObjectives(manager, id, objectives);
      }

      // Se sono forniti tests, gestisci update/create/delete
      if (tests !== undefined) {
        await this.syncTests(manager, id, tests);
      }

      // Se sono forniti exams, gestisci update/create/delete
      if (exams !== undefined) {
        await this.syncExams(manager, id, exams);
      }

      // Ricarica con tutte le relazioni usando il manager della transazione
      const reloadedEvaluation = await manager.findOne(PatientEvaluation, {
        where: { id },
        relations: ['therapeuticPath', 'operator', 'objectives', 'tests', 'exams']
      });

      if (!reloadedEvaluation) {
        throw new NotFoundException(`Valutazione ${id} non trovata dopo l'aggiornamento`);
      }

      return reloadedEvaluation;
    });
  }

  /**
   * Elimina una valutazione (cascade elimina objectives, tests, exams)
   */
  async deleteEvaluation(id: string): Promise<boolean> {
    const result = await this.evaluationRepo.delete(id);
    return (result.affected ?? 0) > 0;
  }

  // ==================== OBJECTIVE OPERATIONS ====================
  // Per la sezione "Valutazione Trattamento"

  /**
   * Segna un obiettivo come raggiunto/non raggiunto
   */
  async markObjectiveAchieved(
    objectiveId: string,
    input: MarkObjectiveAchievedInput
  ): Promise<EvaluationObjective> {
    const objective = await this.objectiveRepo.findOne({
      where: { id: objectiveId }
    });

    if (!objective) {
      throw new NotFoundException(`Obiettivo ${objectiveId} non trovato`);
    }

    objective.raggiunto = input.raggiunto;
    objective.dataRaggiungimento = input.raggiunto ? new Date() : undefined;

    return this.objectiveRepo.save(objective);
  }

  /**
   * Ottiene gli obiettivi di una valutazione
   */
  async findObjectivesByEvaluation(evaluationId: string): Promise<EvaluationObjective[]> {
    return this.objectiveRepo.find({
      where: { evaluationId },
      order: { tipo: 'ASC', orderIndex: 'ASC' }
    });
  }

  // ==================== TEST OPERATIONS ====================
  // Per la sezione "Valutazione Trattamento"

  /**
   * Aggiorna il risultato di un test
   */
  async updateTestResult(
    testId: string,
    input: UpdateTestResultInput
  ): Promise<EvaluationTest> {
    const test = await this.testRepo.findOne({
      where: { id: testId }
    });

    if (!test) {
      throw new NotFoundException(`Test ${testId} non trovato`);
    }

    if (input.risultato !== undefined) {
      test.risultato = input.risultato;
    }
    if (input.superato !== undefined) {
      test.superato = input.superato;
    }
    if (input.dataEsecuzione !== undefined) {
      test.dataEsecuzione = input.dataEsecuzione ? new Date(input.dataEsecuzione) : undefined;
    }

    return this.testRepo.save(test);
  }

  /**
   * Ottiene i test di una valutazione
   */
  async findTestsByEvaluation(evaluationId: string): Promise<EvaluationTest[]> {
    return this.testRepo.find({
      where: { evaluationId },
      order: { sezione: 'ASC', orderIndex: 'ASC' }
    });
  }

  // ==================== EXAM OPERATIONS ====================

  /**
   * Ottiene gli esami diagnostici di una valutazione
   */
  async findExamsByEvaluation(evaluationId: string): Promise<EvaluationExam[]> {
    return this.examRepo.find({
      where: { evaluationId },
      order: { orderIndex: 'ASC' }
    });
  }

  // ==================== SYNC HELPERS ====================
  // Gestiscono update/create/delete delle collezioni

  /**
   * Sincronizza gli obiettivi: aggiorna esistenti, crea nuovi, elimina rimossi
   */
  private async syncObjectives(
    manager: any,
    evaluationId: string,
    objectives: EvaluationObjectiveInput[]
  ): Promise<void> {
    // Ottieni ID degli obiettivi esistenti
    const existingObjectives = await manager.find(EvaluationObjective, {
      where: { evaluationId }
    });
    const existingIds = new Set(existingObjectives.map((o: EvaluationObjective) => o.id));

    // ID degli obiettivi nell'input (solo quelli con ID)
    const inputIds = new Set(objectives.filter(o => o.id).map(o => o.id));

    // Elimina obiettivi non più presenti
    const toDelete = existingObjectives.filter(
      (o: EvaluationObjective) => !inputIds.has(o.id)
    );
    if (toDelete.length > 0) {
      await manager.remove(EvaluationObjective, toDelete);
    }

    // Aggiorna esistenti e crea nuovi
    for (let i = 0; i < objectives.length; i++) {
      const obj = objectives[i];
      if (obj.id && existingIds.has(obj.id)) {
        // Update
        await manager.update(EvaluationObjective, obj.id, {
          ...obj,
          orderIndex: obj.orderIndex ?? i
        });
      } else {
        // Create
        const newObjective = manager.create(EvaluationObjective, {
          ...obj,
          id: undefined, // Lascia che il DB generi l'UUID
          evaluationId,
          orderIndex: obj.orderIndex ?? i
        });
        await manager.save(EvaluationObjective, newObjective);
      }
    }
  }

  /**
   * Sincronizza i test: aggiorna esistenti, crea nuovi, elimina rimossi
   */
  private async syncTests(
    manager: any,
    evaluationId: string,
    tests: EvaluationTestInput[]
  ): Promise<void> {
    const existingTests = await manager.find(EvaluationTest, {
      where: { evaluationId }
    });
    const existingIds = new Set(existingTests.map((t: EvaluationTest) => t.id));
    const inputIds = new Set(tests.filter(t => t.id).map(t => t.id));

    // Elimina test non più presenti
    const toDelete = existingTests.filter((t: EvaluationTest) => !inputIds.has(t.id));
    if (toDelete.length > 0) {
      await manager.remove(EvaluationTest, toDelete);
    }

    // Aggiorna esistenti e crea nuovi
    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      if (test.id && existingIds.has(test.id)) {
        await manager.update(EvaluationTest, test.id, {
          ...test,
          orderIndex: test.orderIndex ?? i
        });
      } else {
        const newTest = manager.create(EvaluationTest, {
          ...test,
          id: undefined,
          evaluationId,
          orderIndex: test.orderIndex ?? i
        });
        await manager.save(EvaluationTest, newTest);
      }
    }
  }

  /**
   * Sincronizza gli esami: aggiorna esistenti, crea nuovi, elimina rimossi
   */
  private async syncExams(
    manager: any,
    evaluationId: string,
    exams: EvaluationExamInput[]
  ): Promise<void> {
    const existingExams = await manager.find(EvaluationExam, {
      where: { evaluationId }
    });
    const existingIds = new Set(existingExams.map((e: EvaluationExam) => e.id));
    const inputIds = new Set(exams.filter(e => e.id).map(e => e.id));

    // Elimina esami non più presenti
    const toDelete = existingExams.filter((e: EvaluationExam) => !inputIds.has(e.id));
    if (toDelete.length > 0) {
      await manager.remove(EvaluationExam, toDelete);
    }

    // Aggiorna esistenti e crea nuovi
    for (let i = 0; i < exams.length; i++) {
      const exam = exams[i];
      if (exam.id && existingIds.has(exam.id)) {
        await manager.update(EvaluationExam, exam.id, {
          ...exam,
          orderIndex: exam.orderIndex ?? i
        });
      } else {
        const newExam = manager.create(EvaluationExam, {
          ...exam,
          id: undefined,
          evaluationId,
          orderIndex: exam.orderIndex ?? i
        });
        await manager.save(EvaluationExam, newExam);
      }
    }
  }

  // ==================== STATISTICS ====================

  /**
   * Conta gli obiettivi raggiunti/totali per una valutazione
   */
  async getObjectivesProgress(evaluationId: string): Promise<{
    total: number;
    achieved: number;
    percentage: number;
  }> {
    const objectives = await this.objectiveRepo.find({
      where: { evaluationId }
    });

    const total = objectives.length;
    const achieved = objectives.filter(o => o.raggiunto).length;
    const percentage = total > 0 ? Math.round((achieved / total) * 100) : 0;

    return { total, achieved, percentage };
  }

  /**
   * Conta i test superati/totali per una valutazione
   */
  async getTestsProgress(evaluationId: string): Promise<{
    total: number;
    passed: number;
    failed: number;
    pending: number;
    percentage: number;
  }> {
    const tests = await this.testRepo.find({
      where: { evaluationId }
    });

    const total = tests.length;
    const passed = tests.filter(t => t.superato === true).length;
    const failed = tests.filter(t => t.superato === false).length;
    const pending = tests.filter(t => t.superato === null || t.superato === undefined).length;
    const percentage = total > 0 ? Math.round((passed / total) * 100) : 0;

    return { total, passed, failed, pending, percentage };
  }

  // ==================== PROGRESS TRACKING (Tab Obiettivi) ====================

  /**
   * Conta i trattamenti completati per un percorso dopo una certa data
   * Considera sia OPERATOR_COMPLETED che CLOSED come trattamenti completati
   */
  private async countTreatmentsSinceLastUpdate(pathId: string, sinceDate: Date): Promise<number> {
    return this.treatmentRepo.count({
      where: [
        {
          therapeuticPathId: pathId,
          status: TreatmentStatus.OPERATOR_COMPLETED,
          startedAt: MoreThan(sinceDate)
        },
        {
          therapeuticPathId: pathId,
          status: TreatmentStatus.CLOSED,
          startedAt: MoreThan(sinceDate)
        }
      ]
    });
  }

  /**
   * Aggiorna il progresso di un obiettivo (scala 0-5) con storico
   */
  async updateObjectiveProgress(
    objectiveId: string,
    input: UpdateObjectiveProgressInput,
    operatorId: string,
    pathId: string
  ): Promise<EvaluationObjective> {
    const objective = await this.objectiveRepo.findOne({
      where: { id: objectiveId }
    });

    if (!objective) {
      throw new NotFoundException(`Obiettivo ${objectiveId} non trovato`);
    }

    // Conta trattamenti dall'ultimo aggiornamento
    const treatmentCount = await this.countTreatmentsSinceLastUpdate(
      pathId,
      objective.updatedAt
    );

    // Crea record storico
    const historyEntry = this.objectiveProgressHistoryRepo.create({
      objectiveId,
      previousLevel: objective.progressLevel,
      newLevel: input.newLevel,
      treatmentsSinceLast: treatmentCount,
      note: input.note,
      operatorId
    });
    await this.objectiveProgressHistoryRepo.save(historyEntry);

    // Aggiorna obiettivo
    objective.progressLevel = input.newLevel;
    objective.raggiunto = input.newLevel === 5;
    if (objective.raggiunto && !objective.dataRaggiungimento) {
      objective.dataRaggiungimento = new Date();
    } else if (!objective.raggiunto) {
      objective.dataRaggiungimento = undefined;
    }

    return this.objectiveRepo.save(objective);
  }

  /**
   * Aggiunge una nuova valutazione a un test (ripetizione) con storico
   */
  async addTestEvaluation(
    testId: string,
    input: AddTestEvaluationInput,
    operatorId: string,
    pathId: string
  ): Promise<EvaluationTest> {
    const test = await this.testRepo.findOne({
      where: { id: testId }
    });

    if (!test) {
      throw new NotFoundException(`Test ${testId} non trovato`);
    }

    // Conta trattamenti dall'ultimo aggiornamento
    const treatmentCount = await this.countTreatmentsSinceLastUpdate(
      pathId,
      test.updatedAt
    );

    // Crea record storico
    const historyEntry = this.testEvaluationHistoryRepo.create({
      testId,
      evaluationLevel: input.evaluationLevel,
      note: input.note,
      treatmentsSinceLast: treatmentCount,
      operatorId
    });
    await this.testEvaluationHistoryRepo.save(historyEntry);

    // Aggiorna test con ultima valutazione
    test.risultato = `${input.evaluationLevel}/5`;
    test.superato = input.evaluationLevel >= 4; // 4-5 = superato
    test.dataEsecuzione = new Date();

    return this.testRepo.save(test);
  }

  /**
   * Ottiene lo storico progressi di un obiettivo
   */
  async getObjectiveProgressHistory(objectiveId: string): Promise<ObjectiveProgressHistory[]> {
    return this.objectiveProgressHistoryRepo.find({
      where: { objectiveId },
      relations: ['operator'],
      order: { createdAt: 'DESC' }
    });
  }

  /**
   * Ottiene lo storico valutazioni di un test
   */
  async getTestEvaluationHistory(testId: string): Promise<TestEvaluationHistory[]> {
    return this.testEvaluationHistoryRepo.find({
      where: { testId },
      relations: ['operator'],
      order: { createdAt: 'DESC' }
    });
  }

  /**
   * Modifica l'ultima valutazione di un test
   * Aggiorna sia il test che l'ultima entry nello storico per mantenere consistenza
   */
  async editTestEvaluation(
    testId: string,
    newLevel: number,
    operatorId: string
  ): Promise<EvaluationTest> {
    const test = await this.testRepo.findOne({
      where: { id: testId }
    });

    if (!test) {
      throw new NotFoundException(`Test ${testId} non trovato`);
    }

    // Trova l'ultima entry dello storico e aggiornala
    const latestEntry = await this.testEvaluationHistoryRepo.findOne({
      where: { testId },
      order: { createdAt: 'DESC' }
    });

    if (latestEntry) {
      // Aggiorna l'ultima entry esistente per mantenere consistenza
      latestEntry.evaluationLevel = newLevel;
      await this.testEvaluationHistoryRepo.save(latestEntry);
    }
    // Se non esiste storico, l'utente deve usare "Ripeti test" per creare la prima entry

    // Aggiorna il valore corrente del test
    test.risultato = `${newLevel}/5`;
    test.superato = newLevel >= 4;

    return this.testRepo.save(test);
  }

  /**
   * Reset valutazione test (cancella storico e resetta a non valutato)
   */
  async resetTestEvaluation(testId: string): Promise<EvaluationTest> {
    const test = await this.testRepo.findOne({
      where: { id: testId }
    });

    if (!test) {
      throw new NotFoundException(`Test ${testId} non trovato`);
    }

    // Cancella storico valutazioni
    await this.testEvaluationHistoryRepo.delete({ testId });

    // Reset campi test
    test.risultato = undefined;
    test.superato = undefined;
    test.dataEsecuzione = undefined;

    return this.testRepo.save(test);
  }

  /**
   * Elimina un test dalla valutazione
   * Controllo: deve restare almeno 1 test se presenti nella scheda valutazione
   */
  async deleteTest(testId: string, evaluationId: string): Promise<boolean> {
    // Conta test rimanenti
    const testsCount = await this.testRepo.count({ where: { evaluationId } });

    if (testsCount <= 1) {
      throw new BadRequestException('Deve restare almeno un test nella scheda valutazione');
    }

    // Cascade delete elimina anche lo storico valutazioni
    const result = await this.testRepo.delete(testId);
    return (result.affected ?? 0) > 0;
  }

  /**
   * Ottiene gli obiettivi con il loro storico progressi
   */
  async getObjectivesWithHistory(evaluationId: string): Promise<EvaluationObjective[]> {
    return this.objectiveRepo.find({
      where: { evaluationId },
      relations: ['progressHistory', 'progressHistory.operator'],
      order: { tipo: 'ASC', orderIndex: 'ASC' }
    });
  }

  /**
   * Ottiene i test con il loro storico valutazioni
   */
  async getTestsWithHistory(evaluationId: string): Promise<EvaluationTest[]> {
    return this.testRepo.find({
      where: { evaluationId },
      relations: ['evaluationHistory', 'evaluationHistory.operator'],
      order: { sezione: 'ASC', orderIndex: 'ASC' }
    });
  }

  /**
   * Modifica una singola entry dello storico valutazioni test
   */
  async editTestEvaluationEntry(
    evaluationHistoryId: string,
    input: { evaluationLevel: number; note?: string }
  ): Promise<TestEvaluationHistory> {
    const entry = await this.testEvaluationHistoryRepo.findOne({
      where: { id: evaluationHistoryId },
      relations: ['operator']
    });

    if (!entry) {
      throw new NotFoundException(`Valutazione ${evaluationHistoryId} non trovata`);
    }

    // Aggiorna i campi
    entry.evaluationLevel = input.evaluationLevel;
    entry.note = input.note;

    const savedEntry = await this.testEvaluationHistoryRepo.save(entry);

    // Aggiorna anche il valore corrente del test se è l'ultima valutazione
    const latestEntry = await this.testEvaluationHistoryRepo.findOne({
      where: { testId: entry.testId },
      order: { createdAt: 'DESC' }
    });

    if (latestEntry && latestEntry.id === evaluationHistoryId) {
      // Questa è l'ultima valutazione, aggiorna il test
      await this.testRepo.update(entry.testId, {
        risultato: `${input.evaluationLevel}/5`,
        superato: input.evaluationLevel >= 4
      });
    }

    return savedEntry;
  }

  /**
   * Elimina una singola entry dello storico valutazioni test
   * Non permette di eliminare se è l'unica valutazione (usare reset)
   */
  async deleteTestEvaluationEntry(evaluationHistoryId: string): Promise<boolean> {
    const entry = await this.testEvaluationHistoryRepo.findOne({
      where: { id: evaluationHistoryId }
    });

    if (!entry) {
      throw new NotFoundException(`Valutazione ${evaluationHistoryId} non trovata`);
    }

    // Conta le valutazioni totali per questo test
    const count = await this.testEvaluationHistoryRepo.count({
      where: { testId: entry.testId }
    });

    if (count <= 1) {
      throw new BadRequestException(
        'Deve restare almeno una valutazione. Usa Reset per eliminare tutto lo storico.'
      );
    }

    // Elimina l'entry
    const result = await this.testEvaluationHistoryRepo.delete(evaluationHistoryId);

    // Se era l'ultima valutazione (più recente), aggiorna il test con la precedente
    const latestEntry = await this.testEvaluationHistoryRepo.findOne({
      where: { testId: entry.testId },
      order: { createdAt: 'DESC' }
    });

    if (latestEntry) {
      await this.testRepo.update(entry.testId, {
        risultato: `${latestEntry.evaluationLevel}/5`,
        superato: latestEntry.evaluationLevel >= 4,
        dataEsecuzione: latestEntry.createdAt
      });
    }

    return (result.affected ?? 0) > 0;
  }
}
