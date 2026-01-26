import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, MoreThan } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { PatientAnamnesis } from '../entities/patient-anamnesis.entity';
import { AnamnesisObjective } from '../entities/anamnesis-objective.entity';
import { AnamnesisTest } from '../entities/anamnesis-test.entity';
import { AnamnesisExam } from '../entities/anamnesis-exam.entity';
import { ObjectiveProgressHistory } from '../entities/objective-progress-history.entity';
import { TestEvaluationHistory } from '../entities/test-evaluation-history.entity';
import { TherapeuticPath } from '../entities/therapeutic-path.entity';
import { Treatment, TreatmentStatus } from '../entities/treatment.entity';
import {
  CreateAnamnesisInput,
  UpdateAnamnesisInput,
  AnamnesisObjectiveInput,
  AnamnesisTestInput,
  AnamnesisExamInput,
  MarkObjectiveAchievedInput,
  UpdateTestResultInput,
  UpdateObjectiveProgressInput,
  AddTestEvaluationInput
} from '../dto/patient-anamnesis.input';

@Injectable()
export class PatientAnamnesisService {
  constructor(
    @InjectRepository(PatientAnamnesis)
    private anamnesisRepo: Repository<PatientAnamnesis>,
    @InjectRepository(AnamnesisObjective)
    private objectiveRepo: Repository<AnamnesisObjective>,
    @InjectRepository(AnamnesisTest)
    private testRepo: Repository<AnamnesisTest>,
    @InjectRepository(AnamnesisExam)
    private examRepo: Repository<AnamnesisExam>,
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

  // ==================== ANAMNESIS CRUD ====================

  /**
   * Crea una nuova anamnesi per un percorso terapeutico
   * Relazione 1:1 con TherapeuticPath
   */
  async createAnamnesis(input: CreateAnamnesisInput): Promise<PatientAnamnesis> {
    // Verifica che il percorso esista
    const path = await this.pathRepo.findOne({
      where: { id: input.therapeuticPathId }
    });

    if (!path) {
      throw new NotFoundException(`Percorso terapeutico ${input.therapeuticPathId} non trovato`);
    }

    // Verifica che non esista già un'anamnesi per questo percorso
    const existingAnamnesis = await this.anamnesisRepo.findOne({
      where: { therapeuticPathId: input.therapeuticPathId }
    });

    if (existingAnamnesis) {
      throw new BadRequestException(
        `Esiste già un'anamnesi per il percorso ${input.therapeuticPathId}. Usa updateAnamnesis per modificarla.`
      );
    }

    // Usa transazione per creare anamnesi + relazioni
    return this.dataSource.transaction(async (manager) => {
      // Estrai gli array per le entità correlate
      const { objectives, tests, exams, ...anamnesisData } = input;

      // Crea l'anamnesi principale
      // Processa i bodyMapMarkers per generare UUID ai nuovi marker
      const anamnesis = manager.create(PatientAnamnesis, {
        ...anamnesisData,
        bodyMapMarkers: this.processBodyMapMarkers(anamnesisData.bodyMapMarkers)
      });
      const savedAnamnesis = await manager.save(PatientAnamnesis, anamnesis);

      // Crea gli obiettivi se presenti
      if (objectives && objectives.length > 0) {
        const objectiveEntities = objectives.map((obj, index) =>
          manager.create(AnamnesisObjective, {
            ...obj,
            anamnesisId: savedAnamnesis.id,
            orderIndex: obj.orderIndex ?? index
          })
        );
        await manager.save(AnamnesisObjective, objectiveEntities);
      }

      // Crea i test se presenti
      if (tests && tests.length > 0) {
        const testEntities = tests.map((test, index) =>
          manager.create(AnamnesisTest, {
            ...test,
            anamnesisId: savedAnamnesis.id,
            orderIndex: test.orderIndex ?? index
          })
        );
        await manager.save(AnamnesisTest, testEntities);
      }

      // Crea gli esami se presenti
      if (exams && exams.length > 0) {
        const examEntities = exams.map((exam, index) =>
          manager.create(AnamnesisExam, {
            ...exam,
            anamnesisId: savedAnamnesis.id,
            orderIndex: exam.orderIndex ?? index
          })
        );
        await manager.save(AnamnesisExam, examEntities);
      }

      // Ricarica l'anamnesi con tutte le relazioni usando il manager della transazione
      const reloadedAnamnesis = await manager.findOne(PatientAnamnesis, {
        where: { id: savedAnamnesis.id },
        relations: ['therapeuticPath', 'operator', 'objectives', 'tests', 'exams']
      });

      if (!reloadedAnamnesis) {
        throw new Error(`Impossibile ricaricare l'anamnesi appena creata con ID ${savedAnamnesis.id}`);
      }

      return reloadedAnamnesis;
    });
  }

  /**
   * Ottiene un'anamnesi per ID con tutte le relazioni
   */
  async findById(id: string): Promise<PatientAnamnesis | null> {
    return this.anamnesisRepo.findOne({
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
   * Ottiene l'anamnesi di un percorso terapeutico
   */
  async findByTherapeuticPath(pathId: string): Promise<PatientAnamnesis | null> {
    return this.anamnesisRepo.findOne({
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
   * Aggiorna un'anamnesi esistente
   * Gestisce sia i campi scalari che le collezioni (objectives, tests, exams)
   */
  async updateAnamnesis(id: string, input: UpdateAnamnesisInput): Promise<PatientAnamnesis> {
    const anamnesis = await this.findById(id);

    if (!anamnesis) {
      throw new NotFoundException(`Anamnesi ${id} non trovata`);
    }

    return this.dataSource.transaction(async (manager) => {
      const { objectives, tests, exams, ...scalarFields } = input;

      // Aggiorna i campi scalari
      if (Object.keys(scalarFields).length > 0) {
        // Processa i bodyMapMarkers per generare UUID ai nuovi marker
        if (scalarFields.bodyMapMarkers) {
          (scalarFields as any).bodyMapMarkers = this.processBodyMapMarkers(scalarFields.bodyMapMarkers);
        }
        Object.assign(anamnesis, scalarFields);
        await manager.save(PatientAnamnesis, anamnesis);
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
      const reloadedAnamnesis = await manager.findOne(PatientAnamnesis, {
        where: { id },
        relations: ['therapeuticPath', 'operator', 'objectives', 'tests', 'exams']
      });

      if (!reloadedAnamnesis) {
        throw new NotFoundException(`Anamnesi ${id} non trovata dopo l'aggiornamento`);
      }

      return reloadedAnamnesis;
    });
  }

  /**
   * Elimina un'anamnesi (cascade elimina objectives, tests, exams)
   */
  async deleteAnamnesis(id: string): Promise<boolean> {
    const result = await this.anamnesisRepo.delete(id);
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
  ): Promise<AnamnesisObjective> {
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
   * Ottiene gli obiettivi di un'anamnesi
   */
  async findObjectivesByAnamnesis(anamnesisId: string): Promise<AnamnesisObjective[]> {
    return this.objectiveRepo.find({
      where: { anamnesisId },
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
  ): Promise<AnamnesisTest> {
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
   * Ottiene i test di un'anamnesi
   */
  async findTestsByAnamnesis(anamnesisId: string): Promise<AnamnesisTest[]> {
    return this.testRepo.find({
      where: { anamnesisId },
      order: { sezione: 'ASC', orderIndex: 'ASC' }
    });
  }

  // ==================== EXAM OPERATIONS ====================

  /**
   * Ottiene gli esami diagnostici di un'anamnesi
   */
  async findExamsByAnamnesis(anamnesisId: string): Promise<AnamnesisExam[]> {
    return this.examRepo.find({
      where: { anamnesisId },
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
    anamnesisId: string,
    objectives: AnamnesisObjectiveInput[]
  ): Promise<void> {
    // Ottieni ID degli obiettivi esistenti
    const existingObjectives = await manager.find(AnamnesisObjective, {
      where: { anamnesisId }
    });
    const existingIds = new Set(existingObjectives.map((o: AnamnesisObjective) => o.id));

    // ID degli obiettivi nell'input (solo quelli con ID)
    const inputIds = new Set(objectives.filter(o => o.id).map(o => o.id));

    // Elimina obiettivi non più presenti
    const toDelete = existingObjectives.filter(
      (o: AnamnesisObjective) => !inputIds.has(o.id)
    );
    if (toDelete.length > 0) {
      await manager.remove(AnamnesisObjective, toDelete);
    }

    // Aggiorna esistenti e crea nuovi
    for (let i = 0; i < objectives.length; i++) {
      const obj = objectives[i];
      if (obj.id && existingIds.has(obj.id)) {
        // Update
        await manager.update(AnamnesisObjective, obj.id, {
          ...obj,
          orderIndex: obj.orderIndex ?? i
        });
      } else {
        // Create
        const newObjective = manager.create(AnamnesisObjective, {
          ...obj,
          id: undefined, // Lascia che il DB generi l'UUID
          anamnesisId,
          orderIndex: obj.orderIndex ?? i
        });
        await manager.save(AnamnesisObjective, newObjective);
      }
    }
  }

  /**
   * Sincronizza i test: aggiorna esistenti, crea nuovi, elimina rimossi
   */
  private async syncTests(
    manager: any,
    anamnesisId: string,
    tests: AnamnesisTestInput[]
  ): Promise<void> {
    const existingTests = await manager.find(AnamnesisTest, {
      where: { anamnesisId }
    });
    const existingIds = new Set(existingTests.map((t: AnamnesisTest) => t.id));
    const inputIds = new Set(tests.filter(t => t.id).map(t => t.id));

    // Elimina test non più presenti
    const toDelete = existingTests.filter((t: AnamnesisTest) => !inputIds.has(t.id));
    if (toDelete.length > 0) {
      await manager.remove(AnamnesisTest, toDelete);
    }

    // Aggiorna esistenti e crea nuovi
    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      if (test.id && existingIds.has(test.id)) {
        await manager.update(AnamnesisTest, test.id, {
          ...test,
          orderIndex: test.orderIndex ?? i
        });
      } else {
        const newTest = manager.create(AnamnesisTest, {
          ...test,
          id: undefined,
          anamnesisId,
          orderIndex: test.orderIndex ?? i
        });
        await manager.save(AnamnesisTest, newTest);
      }
    }
  }

  /**
   * Sincronizza gli esami: aggiorna esistenti, crea nuovi, elimina rimossi
   */
  private async syncExams(
    manager: any,
    anamnesisId: string,
    exams: AnamnesisExamInput[]
  ): Promise<void> {
    const existingExams = await manager.find(AnamnesisExam, {
      where: { anamnesisId }
    });
    const existingIds = new Set(existingExams.map((e: AnamnesisExam) => e.id));
    const inputIds = new Set(exams.filter(e => e.id).map(e => e.id));

    // Elimina esami non più presenti
    const toDelete = existingExams.filter((e: AnamnesisExam) => !inputIds.has(e.id));
    if (toDelete.length > 0) {
      await manager.remove(AnamnesisExam, toDelete);
    }

    // Aggiorna esistenti e crea nuovi
    for (let i = 0; i < exams.length; i++) {
      const exam = exams[i];
      if (exam.id && existingIds.has(exam.id)) {
        await manager.update(AnamnesisExam, exam.id, {
          ...exam,
          orderIndex: exam.orderIndex ?? i
        });
      } else {
        const newExam = manager.create(AnamnesisExam, {
          ...exam,
          id: undefined,
          anamnesisId,
          orderIndex: exam.orderIndex ?? i
        });
        await manager.save(AnamnesisExam, newExam);
      }
    }
  }

  // ==================== STATISTICS ====================

  /**
   * Conta gli obiettivi raggiunti/totali per un'anamnesi
   */
  async getObjectivesProgress(anamnesisId: string): Promise<{
    total: number;
    achieved: number;
    percentage: number;
  }> {
    const objectives = await this.objectiveRepo.find({
      where: { anamnesisId }
    });

    const total = objectives.length;
    const achieved = objectives.filter(o => o.raggiunto).length;
    const percentage = total > 0 ? Math.round((achieved / total) * 100) : 0;

    return { total, achieved, percentage };
  }

  /**
   * Conta i test superati/totali per un'anamnesi
   */
  async getTestsProgress(anamnesisId: string): Promise<{
    total: number;
    passed: number;
    failed: number;
    pending: number;
    percentage: number;
  }> {
    const tests = await this.testRepo.find({
      where: { anamnesisId }
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
  ): Promise<AnamnesisObjective> {
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
  ): Promise<AnamnesisTest> {
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
   * Modifica l'ultima valutazione di un test (senza creare storico)
   */
  async editTestEvaluation(
    testId: string,
    newLevel: number,
    operatorId: string
  ): Promise<AnamnesisTest> {
    const test = await this.testRepo.findOne({
      where: { id: testId }
    });

    if (!test) {
      throw new NotFoundException(`Test ${testId} non trovato`);
    }

    // Aggiorna solo il valore corrente
    test.risultato = `${newLevel}/5`;
    test.superato = newLevel >= 4;

    return this.testRepo.save(test);
  }

  /**
   * Reset valutazione test (cancella storico e resetta a non valutato)
   */
  async resetTestEvaluation(testId: string): Promise<AnamnesisTest> {
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
   * Elimina un test dall'anamnesi
   * Controllo: deve restare almeno 1 test se presenti nella scheda anamnesi
   */
  async deleteTest(testId: string, anamnesisId: string): Promise<boolean> {
    // Conta test rimanenti
    const testsCount = await this.testRepo.count({ where: { anamnesisId } });

    if (testsCount <= 1) {
      throw new BadRequestException('Deve restare almeno un test nella scheda anamnesi');
    }

    // Cascade delete elimina anche lo storico valutazioni
    const result = await this.testRepo.delete(testId);
    return (result.affected ?? 0) > 0;
  }

  /**
   * Ottiene gli obiettivi con il loro storico progressi
   */
  async getObjectivesWithHistory(anamnesisId: string): Promise<AnamnesisObjective[]> {
    return this.objectiveRepo.find({
      where: { anamnesisId },
      relations: ['progressHistory', 'progressHistory.operator'],
      order: { tipo: 'ASC', orderIndex: 'ASC' }
    });
  }

  /**
   * Ottiene i test con il loro storico valutazioni
   */
  async getTestsWithHistory(anamnesisId: string): Promise<AnamnesisTest[]> {
    return this.testRepo.find({
      where: { anamnesisId },
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
