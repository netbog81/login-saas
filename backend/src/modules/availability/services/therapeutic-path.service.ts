import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, In } from 'typeorm';
import { TherapeuticPath, TherapeuticPathStatus } from '../entities/therapeutic-path.entity';
import { PathDocument, DocumentType, DocumentCategory } from '../entities/path-document.entity';
import { Patient } from '../../../entities/patient.entity';
import { Treatment, TreatmentStatus } from '../entities/treatment.entity';
import { TreatmentInstrument } from '../entities/treatment-instrument.entity';
import { AvailabilityAppointment } from '../entities/availability-appointment.entity';

// ==================== INPUT INTERFACES ====================

export interface CreateTherapeuticPathInput {
  patientId: string;
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
    @InjectRepository(PathDocument)
    private documentRepo: Repository<PathDocument>,
    @InjectRepository(Patient)
    private patientRepo: Repository<Patient>,
    private dataSource: DataSource,
  ) {}

  // ==================== THERAPEUTIC PATH CRUD ====================

  /**
   * Crea un nuovo percorso terapeutico.
   *
   * L'ownership del percorso (chi può modificarlo/eliminarlo) è derivata
   * da `primaryOperatorId → Operator.appUserId`: non viene tracciato un
   * `createdByUserId` separato.
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
      status: TherapeuticPathStatus.ACTIVE,
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
      relations: ['patient', 'primaryOperator', 'documents']
    });
  }

  /**
   * Ottiene tutti i percorsi di un paziente
   */
  async findByPatient(patientId: string): Promise<TherapeuticPath[]> {
    return this.pathRepo.find({
      where: { patientId },
      relations: ['patient', 'primaryOperator', 'documents'],
      order: { createdAt: 'DESC' }
    });
  }

  /**
   * Ottiene tutti i percorsi per più pazienti in una singola query.
   */
  async findByPatients(patientIds: string[]): Promise<TherapeuticPath[]> {
    if (patientIds.length === 0) return [];
    return this.pathRepo.find({
      where: { patientId: In(patientIds) },
      relations: ['patient', 'primaryOperator', 'documents'],
      order: { createdAt: 'DESC' }
    });
  }

  /**
   * Ottiene i percorsi attivi di un paziente
   */
  async findActiveByPatient(patientId: string): Promise<TherapeuticPath[]> {
    return this.pathRepo.find({
      where: {
        patientId,
        status: TherapeuticPathStatus.ACTIVE
      },
      relations: ['patient', 'primaryOperator', 'documents'],
      order: { createdAt: 'DESC' }
    });
  }

  /**
   * Ottiene i percorsi gestiti da un operatore
   */
  async findByOperator(operatorId: string): Promise<TherapeuticPath[]> {
    return this.pathRepo.find({
      where: { primaryOperatorId: operatorId },
      relations: ['patient', 'primaryOperator', 'documents'],
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
   * Soft-delete di un percorso terapeutico (sposta nel cestino).
   *
   * Cascade manuale su:
   *  - Treatment figli (+ TreatmentInstrument, + AvailabilityAppointment 1-1)
   *  - PatientEvaluation collegata (+ Objectives / Tests / Exams)
   *
   * **Blocco**: se il percorso contiene trattamenti in stato CLOSED oppure
   * con `readyForBilling = true`, l'eliminazione è rifiutata — tali percorsi
   * possono solo essere archiviati (status = ARCHIVED). L'eliminazione
   * definitiva di un percorso con trattamenti fatturati è consentita solo
   * ad admin tramite `hardDeletePath()` dal cestino, con doppia conferma.
   *
   * @param id - id del percorso
   * @param deletedByUserId - AppUser che elimina (per audit)
   */
  async deletePath(id: string, deletedByUserId?: string): Promise<boolean> {
    const path = await this.pathRepo.findOne({ where: { id } });
    if (!path) {
      throw new NotFoundException(`Percorso ${id} non trovato`);
    }

    const billedCount = await this.dataSource
      .getRepository(Treatment)
      .createQueryBuilder('t')
      .where('t."therapeuticPathId" = :id', { id })
      .andWhere('t."deletedAt" IS NULL')
      .andWhere(
        '(t.status = :closed OR t."readyForBilling" = true OR t."isInvoicedToPatient" = true)',
        { closed: TreatmentStatus.CLOSED },
      )
      .getCount();

    if (billedCount > 0) {
      throw new ForbiddenException(
        `Il percorso contiene ${billedCount} trattament${billedCount === 1 ? 'o chiuso o fatturato' : 'i chiusi o fatturati'}: ` +
          `non può essere eliminato. Puoi archiviarlo (status = ARCHIVED) oppure chiedere a un admin di procedere dal cestino.`,
      );
    }

    await this.dataSource.transaction(async manager => {
      const now = new Date();
      const audit = { deletedAt: now, deletedByUserId: deletedByUserId ?? null } as any;

      // Trattamenti figli + loro strumenti + loro appuntamenti 1-1
      const treatmentIds = (
        await manager
          .createQueryBuilder()
          .select('t.id', 'id')
          .addSelect('t."appointmentId"', 'appointmentId')
          .from(Treatment, 't')
          .where('t."therapeuticPathId" = :id AND t."deletedAt" IS NULL', { id })
          .getRawMany<{ id: string; appointmentId: string }>()
      );

      if (treatmentIds.length > 0) {
        const ids = treatmentIds.map(r => r.id);
        const apptIds = treatmentIds
          .map(r => r.appointmentId)
          .filter((v): v is string => !!v);

        await manager
          .createQueryBuilder()
          .update(TreatmentInstrument)
          .set(audit)
          .where('"treatmentId" IN (:...ids) AND "deletedAt" IS NULL', { ids })
          .execute();

        await manager
          .createQueryBuilder()
          .update(Treatment)
          .set(audit)
          .where('id IN (:...ids)', { ids })
          .execute();

        if (apptIds.length > 0) {
          await manager
            .createQueryBuilder()
            .update(AvailabilityAppointment)
            .set(audit)
            .where('id IN (:...ids) AND "deletedAt" IS NULL', { ids: apptIds })
            .execute();
        }
      }

      // Valutazione + figli: SQL diretto per chiarezza del cascade
      await manager.query(
        `UPDATE "evaluation_objectives" SET "deletedAt" = $1, "deletedByUserId" = $2
         WHERE "evaluationId" IN (
           SELECT id FROM "patient_evaluations" WHERE "therapeuticPathId" = $3 AND "deletedAt" IS NULL
         ) AND "deletedAt" IS NULL`,
        [now, deletedByUserId ?? null, id],
      );
      await manager.query(
        `UPDATE "evaluation_tests" SET "deletedAt" = $1, "deletedByUserId" = $2
         WHERE "evaluationId" IN (
           SELECT id FROM "patient_evaluations" WHERE "therapeuticPathId" = $3 AND "deletedAt" IS NULL
         ) AND "deletedAt" IS NULL`,
        [now, deletedByUserId ?? null, id],
      );
      await manager.query(
        `UPDATE "evaluation_exams" SET "deletedAt" = $1, "deletedByUserId" = $2
         WHERE "evaluationId" IN (
           SELECT id FROM "patient_evaluations" WHERE "therapeuticPathId" = $3 AND "deletedAt" IS NULL
         ) AND "deletedAt" IS NULL`,
        [now, deletedByUserId ?? null, id],
      );
      await manager.query(
        `UPDATE "patient_evaluations" SET "deletedAt" = $1, "deletedByUserId" = $2
         WHERE "therapeuticPathId" = $3 AND "deletedAt" IS NULL`,
        [now, deletedByUserId ?? null, id],
      );

      await manager
        .createQueryBuilder()
        .update(TherapeuticPath)
        .set(audit)
        .where('id = :id', { id })
        .execute();
    });

    return true;
  }

  /**
   * Ripristina un percorso dal cestino insieme a tutti i figli
   * soft-deletati nello stesso istante.
   */
  async restorePath(id: string): Promise<TherapeuticPath> {
    const path = await this.pathRepo.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!path) {
      throw new NotFoundException(`Percorso ${id} non trovato`);
    }
    if (!path.deletedAt) {
      throw new BadRequestException(`Percorso ${id} non è nel cestino.`);
    }

    const deletedAt = path.deletedAt;
    const toleranceMs = 5000;
    const from = new Date(deletedAt.getTime() - toleranceMs);
    const to = new Date(deletedAt.getTime() + toleranceMs);

    await this.dataSource.transaction(async manager => {
      // Ripristina solo i figli soft-deletati nella stessa finestra temporale
      // (evita di riportare in vita record cancellati in precedenza).
      await manager.query(
        `UPDATE "treatment_instruments" SET "deletedAt" = NULL, "deletedByUserId" = NULL
         WHERE "treatmentId" IN (
           SELECT id FROM "treatments" WHERE "therapeuticPathId" = $1
         ) AND "deletedAt" BETWEEN $2 AND $3`,
        [id, from, to],
      );

      await manager.query(
        `UPDATE "availability_appointments" SET "deletedAt" = NULL, "deletedByUserId" = NULL
         WHERE id IN (
           SELECT "appointmentId" FROM "treatments"
           WHERE "therapeuticPathId" = $1 AND "deletedAt" BETWEEN $2 AND $3
         ) AND "deletedAt" BETWEEN $2 AND $3`,
        [id, from, to],
      );

      await manager.query(
        `UPDATE "treatments" SET "deletedAt" = NULL, "deletedByUserId" = NULL
         WHERE "therapeuticPathId" = $1 AND "deletedAt" BETWEEN $2 AND $3`,
        [id, from, to],
      );

      await manager.query(
        `UPDATE "evaluation_objectives" SET "deletedAt" = NULL, "deletedByUserId" = NULL
         WHERE "evaluationId" IN (
           SELECT id FROM "patient_evaluations" WHERE "therapeuticPathId" = $1
         ) AND "deletedAt" BETWEEN $2 AND $3`,
        [id, from, to],
      );
      await manager.query(
        `UPDATE "evaluation_tests" SET "deletedAt" = NULL, "deletedByUserId" = NULL
         WHERE "evaluationId" IN (
           SELECT id FROM "patient_evaluations" WHERE "therapeuticPathId" = $1
         ) AND "deletedAt" BETWEEN $2 AND $3`,
        [id, from, to],
      );
      await manager.query(
        `UPDATE "evaluation_exams" SET "deletedAt" = NULL, "deletedByUserId" = NULL
         WHERE "evaluationId" IN (
           SELECT id FROM "patient_evaluations" WHERE "therapeuticPathId" = $1
         ) AND "deletedAt" BETWEEN $2 AND $3`,
        [id, from, to],
      );
      await manager.query(
        `UPDATE "patient_evaluations" SET "deletedAt" = NULL, "deletedByUserId" = NULL
         WHERE "therapeuticPathId" = $1 AND "deletedAt" BETWEEN $2 AND $3`,
        [id, from, to],
      );

      await manager.query(
        `UPDATE "therapeutic_paths" SET "deletedAt" = NULL, "deletedByUserId" = NULL WHERE id = $1`,
        [id],
      );
    });

    return (await this.pathRepo.findOne({ where: { id } }))!;
  }

  /**
   * Eliminazione definitiva di un percorso (admin-only, dal cestino).
   * CASCADE DB elimina automaticamente treatments, evaluations, documents.
   */
  async hardDeletePath(id: string): Promise<boolean> {
    const result = await this.pathRepo.delete(id);
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
  async countPathsByStatus(patientId: string): Promise<Record<TherapeuticPathStatus, number>> {
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
