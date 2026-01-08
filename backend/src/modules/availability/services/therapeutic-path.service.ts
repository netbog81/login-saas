import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { TherapeuticPath, TherapeuticPathStatus } from '../entities/therapeutic-path.entity';
import { PatientEvaluation } from '../entities/patient-evaluation.entity';
import { PathDocument, DocumentType, DocumentCategory } from '../entities/path-document.entity';
import { Patient } from '../../../entities/patient.entity';

// ==================== INPUT INTERFACES ====================

export interface CreateTherapeuticPathInput {
  patientId: number;
  primaryOperatorId: string;
  name: string;
  diagnosis?: string;
  icdCode?: string;
  externalDoctorName?: string;
  externalPrescriptionRef?: string;
  notes?: string;
}

export interface UpdateTherapeuticPathInput {
  name?: string;
  diagnosis?: string;
  icdCode?: string;
  status?: TherapeuticPathStatus;
  externalDoctorName?: string;
  externalPrescriptionRef?: string;
  notes?: string;
}

export interface CreateEvaluationInput {
  therapeuticPathId: string;
  operatorId: string;
  templateId?: string;
  chiefComplaint?: string;
  historyOfPresentIllness?: string;
  aggravatingFactors?: string;
  relievingFactors?: string;
  patientGoals?: string;
  therapistGoals?: string;
  functionalAssessment?: string;
  conclusions?: string;
  fieldValues?: Record<string, unknown>;
}

export interface UpdateEvaluationInput {
  chiefComplaint?: string;
  historyOfPresentIllness?: string;
  aggravatingFactors?: string;
  relievingFactors?: string;
  patientGoals?: string;
  therapistGoals?: string;
  functionalAssessment?: string;
  conclusions?: string;
  fieldValues?: Record<string, unknown>;
}

export interface CreateDocumentInput {
  therapeuticPathId: string;
  type: DocumentType;
  category: DocumentCategory;
  fileName: string;
  originalFileName?: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  thumbnailPath?: string;
  externalDoctorName?: string;
  notes?: string;
  description?: string;
  uploadedBy?: string;
}

// ==================== SERVICE ====================

@Injectable()
export class TherapeuticPathService {
  constructor(
    @InjectRepository(TherapeuticPath)
    private pathRepo: Repository<TherapeuticPath>,
    @InjectRepository(PatientEvaluation)
    private evaluationRepo: Repository<PatientEvaluation>,
    @InjectRepository(PathDocument)
    private documentRepo: Repository<PathDocument>,
    @InjectRepository(Patient)
    private patientRepo: Repository<Patient>,
    private dataSource: DataSource,
  ) {}

  // ==================== THERAPEUTIC PATH CRUD ====================

  /**
   * Crea un nuovo percorso terapeutico
   */
  async createPath(input: CreateTherapeuticPathInput): Promise<TherapeuticPath> {
    // Verifica che il paziente esista
    const patient = await this.patientRepo.findOne({
      where: { id: input.patientId }
    });

    if (!patient) {
      throw new NotFoundException(`Paziente ${input.patientId} non trovato`);
    }

    const path = this.pathRepo.create({
      ...input,
      status: TherapeuticPathStatus.ACTIVE
    });

    const savedPath = await this.pathRepo.save(path);

    // Ricarica con le relazioni per restituire l'oggetto completo
    return this.findById(savedPath.id) as Promise<TherapeuticPath>;
  }

  /**
   * Ottiene un percorso per ID con relazioni
   */
  async findById(id: string): Promise<TherapeuticPath | null> {
    return this.pathRepo.findOne({
      where: { id },
      relations: ['patient', 'primaryOperator', 'evaluations', 'documents']
    });
  }

  /**
   * Ottiene tutti i percorsi di un paziente
   */
  async findByPatient(patientId: number): Promise<TherapeuticPath[]> {
    return this.pathRepo.find({
      where: { patientId },
      relations: ['patient', 'primaryOperator', 'evaluations', 'documents'],
      order: { createdAt: 'DESC' }
    });
  }

  /**
   * Ottiene i percorsi attivi di un paziente
   */
  async findActiveByPatient(patientId: number): Promise<TherapeuticPath[]> {
    return this.pathRepo.find({
      where: {
        patientId,
        status: TherapeuticPathStatus.ACTIVE
      },
      relations: ['patient', 'primaryOperator', 'evaluations', 'documents'],
      order: { createdAt: 'DESC' }
    });
  }

  /**
   * Ottiene i percorsi gestiti da un operatore
   */
  async findByOperator(operatorId: string): Promise<TherapeuticPath[]> {
    return this.pathRepo.find({
      where: { primaryOperatorId: operatorId },
      relations: ['patient', 'primaryOperator', 'evaluations', 'documents'],
      order: { createdAt: 'DESC' }
    });
  }

  /**
   * Aggiorna un percorso terapeutico
   */
  async updatePath(id: string, input: UpdateTherapeuticPathInput): Promise<TherapeuticPath> {
    const path = await this.findById(id);

    if (!path) {
      throw new NotFoundException(`Percorso terapeutico ${id} non trovato`);
    }

    // Se si sta chiudendo il percorso, imposta closedAt
    if (input.status &&
        (input.status === TherapeuticPathStatus.COMPLETED ||
         input.status === TherapeuticPathStatus.ARCHIVED) &&
        path.status === TherapeuticPathStatus.ACTIVE) {
      path.closedAt = new Date();
    }

    Object.assign(path, input);
    return this.pathRepo.save(path);
  }

  /**
   * Elimina un percorso terapeutico (cascade elimina evaluations e documents)
   */
  async deletePath(id: string): Promise<boolean> {
    const result = await this.pathRepo.delete(id);
    return (result.affected ?? 0) > 0;
  }

  // ==================== PATIENT EVALUATION CRUD ====================

  /**
   * Crea una nuova valutazione
   */
  async createEvaluation(input: CreateEvaluationInput): Promise<PatientEvaluation> {
    // Verifica che il percorso esista
    const path = await this.pathRepo.findOne({
      where: { id: input.therapeuticPathId }
    });

    if (!path) {
      throw new NotFoundException(`Percorso terapeutico ${input.therapeuticPathId} non trovato`);
    }

    const evaluation = this.evaluationRepo.create(input);
    return this.evaluationRepo.save(evaluation);
  }

  /**
   * Ottiene una valutazione per ID
   */
  async findEvaluationById(id: string): Promise<PatientEvaluation | null> {
    return this.evaluationRepo.findOne({
      where: { id },
      relations: ['therapeuticPath', 'operator']
    });
  }

  /**
   * Ottiene tutte le valutazioni di un percorso
   */
  async findEvaluationsByPath(pathId: string): Promise<PatientEvaluation[]> {
    return this.evaluationRepo.find({
      where: { therapeuticPathId: pathId },
      relations: ['operator'],
      order: { createdAt: 'DESC' }
    });
  }

  /**
   * Aggiorna una valutazione
   */
  async updateEvaluation(id: string, input: UpdateEvaluationInput): Promise<PatientEvaluation> {
    const evaluation = await this.findEvaluationById(id);

    if (!evaluation) {
      throw new NotFoundException(`Valutazione ${id} non trovata`);
    }

    Object.assign(evaluation, input);
    return this.evaluationRepo.save(evaluation);
  }

  /**
   * Elimina una valutazione
   */
  async deleteEvaluation(id: string): Promise<boolean> {
    const result = await this.evaluationRepo.delete(id);
    return (result.affected ?? 0) > 0;
  }

  // ==================== PATH DOCUMENT CRUD ====================

  /**
   * Crea un nuovo documento
   */
  async createDocument(input: CreateDocumentInput): Promise<PathDocument> {
    // Verifica che il percorso esista
    const path = await this.pathRepo.findOne({
      where: { id: input.therapeuticPathId }
    });

    if (!path) {
      throw new NotFoundException(`Percorso terapeutico ${input.therapeuticPathId} non trovato`);
    }

    const document = this.documentRepo.create(input);
    return this.documentRepo.save(document);
  }

  /**
   * Ottiene un documento per ID
   */
  async findDocumentById(id: string): Promise<PathDocument | null> {
    return this.documentRepo.findOne({
      where: { id },
      relations: ['therapeuticPath']
    });
  }

  /**
   * Ottiene tutti i documenti di un percorso
   */
  async findDocumentsByPath(pathId: string): Promise<PathDocument[]> {
    return this.documentRepo.find({
      where: { therapeuticPathId: pathId },
      order: { uploadedAt: 'DESC' }
    });
  }

  /**
   * Ottiene documenti per categoria
   */
  async findDocumentsByCategory(pathId: string, category: DocumentCategory): Promise<PathDocument[]> {
    return this.documentRepo.find({
      where: {
        therapeuticPathId: pathId,
        category
      },
      order: { uploadedAt: 'DESC' }
    });
  }

  /**
   * Elimina un documento
   * Nota: Il file fisico deve essere eliminato separatamente dal chiamante
   */
  async deleteDocument(id: string): Promise<boolean> {
    const result = await this.documentRepo.delete(id);
    return (result.affected ?? 0) > 0;
  }

  // ==================== STATISTICS ====================

  /**
   * Conta i percorsi per stato di un paziente
   */
  async countPathsByStatus(patientId: number): Promise<Record<TherapeuticPathStatus, number>> {
    const counts = await this.pathRepo
      .createQueryBuilder('path')
      .select('path.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('path.patientId = :patientId', { patientId })
      .groupBy('path.status')
      .getRawMany();

    const result: Record<TherapeuticPathStatus, number> = {
      [TherapeuticPathStatus.ACTIVE]: 0,
      [TherapeuticPathStatus.SUSPENDED]: 0,
      [TherapeuticPathStatus.COMPLETED]: 0,
      [TherapeuticPathStatus.ARCHIVED]: 0
    };

    counts.forEach(c => {
      result[c.status as TherapeuticPathStatus] = parseInt(c.count, 10);
    });

    return result;
  }
}
