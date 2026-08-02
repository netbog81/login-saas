import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import { pipeline as pipelineAsync } from 'stream/promises';
import { IsNull, Not } from 'typeorm';
import { TenantContextService } from '@curandis/tenant-datasource';
import { TransitEncryptionService } from '@curandis/encryption-core';
import {
  EnvelopeCryptoService,
  S3ObjectStorageService,
} from '@curandis/storage-core';
import { PatientDocument } from '../entities/patient-document.entity';
import {
  PatientDocumentCategory,
  PatientDocumentKind,
  PatientDocumentScope,
  kindFromMimeType,
} from '../entities/patient-document-enums';
import {
  PatientDocumentsFilterInput,
  PatientDocumentStats,
  UpdatePatientDocumentInput,
} from '../dto/patient-documents.dto';
import { TherapeuticPath } from '../../availability/entities/therapeutic-path.entity';
import { Treatment } from '../../availability/entities/treatment.entity';

export interface UploadDocumentParams {
  subjectId: string;
  fileStream: Readable;
  originalFileName: string;
  mimeType: string;
  therapeuticPathId?: string;
  treatmentId?: string;
  category?: PatientDocumentCategory;
  notes?: string;
  description?: string;
  externalDoctorName?: string;
  uploadedBy?: string;
  organizationId?: string;
}

export interface DownloadDocumentResult {
  document: PatientDocument;
  /** Stream del plaintext (S3 → decipher). Errore GCM emesso a fine stream. */
  stream: Readable;
}

/**
 * Documenti scheda paziente — orchestrazione envelope encryption + S3.
 *
 * Upload:  Transit datakey (chiave clinico-docs-<tenant>) → pipeline
 *          sorgente → meter(sha256+bytes) → AES-256-GCM → S3 multipart.
 *          La DEK in chiaro vive solo per la durata dell'upload; nel DB
 *          resta il wrap "vault:vN:..." + IV + auth tag.
 * Download: unwrap DEK via Transit → S3 GetObject → decipher → caller.
 *
 * Associazioni (3 livelli): generale / percorso / trattamento.
 * Con treatmentId il percorso è denormalizzato e validato (il trattamento
 * deve appartenere al percorso, il percorso al paziente).
 */
@Injectable()
export class PatientDocumentsService {
  private readonly logger = new Logger(PatientDocumentsService.name);

  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly transit: TransitEncryptionService,
    private readonly envelope: EnvelopeCryptoService,
    private readonly storage: S3ObjectStorageService,
  ) {}

  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get docRepo() {
    return this.dataSource.getRepository(PatientDocument);
  }

  private get tenantAlias(): string {
    const alias = this.tenantContext.getTenantAlias();
    if (!alias) throw new Error('No tenant alias in current request context');
    return alias;
  }

  /** Nome chiave Transit per-tenant (crypto-shredding per offboarding). */
  private transitKeyName(): string {
    const prefix = process.env.DOCS_TRANSIT_KEY_PREFIX || 'clinico-docs';
    return `${prefix}-${this.tenantAlias}`;
  }

  // ==================== UPLOAD ====================

  async uploadDocument(params: UploadDocumentParams): Promise<PatientDocument> {
    const tenantAlias = this.tenantAlias;
    const association = await this.validateAssociation(
      params.subjectId,
      params.therapeuticPathId,
      params.treatmentId,
    );

    const documentId = randomUUID();
    const objectKey = `patients/${params.subjectId}/${documentId}`;
    const keyName = this.transitKeyName();

    // DEK per documento: generata da Transit, usata localmente, mai persistita
    const dataKey = await this.transit.generateDataKey(keyName);
    const enc = this.envelope.createEncryptionPipeline(dataKey.plaintextKey);

    let uploadResult;
    try {
      // pump: sorgente → meter (che internamente pipe-a nel cipher).
      // Se la sorgente fallisce distruggiamo il cipher così anche
      // l'upload S3 fallisce e aborta la multipart (no oggetti orfani).
      const pump = pipelineAsync(params.fileStream, enc.meter).catch((err) => {
        enc.cipher.destroy(err instanceof Error ? err : new Error(String(err)));
        throw err;
      });

      const upload = this.storage.uploadStream({
        tenantAlias,
        key: objectKey,
        body: enc.cipher,
        contentType: 'application/octet-stream',
      });

      [, uploadResult] = await Promise.all([pump, upload]);
    } finally {
      // La DEK in chiaro non deve sopravvivere all'upload
      dataKey.plaintextKey.fill(0);
    }

    const meta = enc.buildMeta();
    if (meta.plaintextBytes === 0) {
      await this.storage.deleteObject({ tenantAlias, key: objectKey }).catch(() => undefined);
      throw new BadRequestException('Empty file');
    }

    try {
      const doc = this.docRepo.create({
        id: documentId,
        subjectId: params.subjectId,
        organizationId: params.organizationId,
        therapeuticPathId: association.therapeuticPathId,
        treatmentId: association.treatmentId,
        category: params.category || PatientDocumentCategory.OTHER,
        contentKind: kindFromMimeType(params.mimeType),
        originalFileName: params.originalFileName,
        mimeType: params.mimeType,
        fileSize: String(meta.plaintextBytes),
        sha256: meta.plaintextSha256,
        bucket: uploadResult.bucket,
        objectKey,
        encAlgorithm: meta.algorithm,
        encWrappedDek: dataKey.wrappedKey,
        encIv: meta.ivBase64,
        encAuthTag: meta.authTagBase64,
        encKeyName: keyName,
        encKeyVersion: dataKey.keyVersion,
        externalDoctorName: params.externalDoctorName,
        notes: params.notes,
        description: params.description,
        uploadedBy: params.uploadedBy,
      });
      const saved = await this.docRepo.save(doc);
      this.logger.log(
        `Document ${documentId} uploaded (subject=${params.subjectId}, ` +
          `${meta.plaintextBytes} bytes, kind=${saved.contentKind}, tenant=${tenantAlias})`,
      );
      return saved;
    } catch (err) {
      // Riga non salvata → l'oggetto S3 sarebbe orfano: cleanup best-effort
      await this.storage.deleteObject({ tenantAlias, key: objectKey }).catch(() => undefined);
      throw err;
    }
  }

  /**
   * Valida la coerenza dei 3 livelli e denormalizza il percorso dal
   * trattamento. Regole:
   *  - trattamento ⇒ percorso (sempre valorizzato, coerente col trattamento)
   *  - percorso ⇒ deve appartenere al paziente (patientId === subjectId)
   */
  private async validateAssociation(
    subjectId: string,
    therapeuticPathId?: string,
    treatmentId?: string,
  ): Promise<{ therapeuticPathId?: string; treatmentId?: string }> {
    if (!treatmentId && !therapeuticPathId) {
      return {}; // documento generale
    }

    let resolvedPathId = therapeuticPathId;

    if (treatmentId) {
      const treatment = await this.dataSource
        .getRepository(Treatment)
        .findOne({ where: { id: treatmentId } });
      if (!treatment) {
        throw new BadRequestException(`Treatment ${treatmentId} not found`);
      }
      if (resolvedPathId && resolvedPathId !== treatment.therapeuticPathId) {
        throw new BadRequestException(
          'Treatment does not belong to the specified therapeutic path',
        );
      }
      resolvedPathId = treatment.therapeuticPathId;
    }

    if (resolvedPathId) {
      const path = await this.dataSource
        .getRepository(TherapeuticPath)
        .findOne({ where: { id: resolvedPathId } });
      if (!path) {
        throw new BadRequestException(`Therapeutic path ${resolvedPathId} not found`);
      }
      if (path.patientId !== subjectId) {
        throw new BadRequestException(
          'Therapeutic path does not belong to the specified patient',
        );
      }
    }

    return { therapeuticPathId: resolvedPathId, treatmentId };
  }

  // ==================== DOWNLOAD ====================

  async downloadDocument(id: string): Promise<DownloadDocumentResult> {
    const document = await this.docRepo.findOne({ where: { id } });
    if (!document) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    const dek = await this.transit.unwrapDataKey(document.encKeyName, document.encWrappedDek);
    const decipher = this.envelope.createDecryptionStream(
      dek,
      document.encIv,
      document.encAuthTag,
    );
    const s3Stream = await this.storage.downloadStream({
      tenantAlias: this.tenantAlias,
      key: document.objectKey,
    });

    s3Stream.on('error', (err) => decipher.destroy(err));
    return { document, stream: s3Stream.pipe(decipher) as unknown as Readable };
  }

  // ==================== LIST / STATS ====================

  async listDocuments(
    subjectId: string,
    filter?: PatientDocumentsFilterInput,
  ): Promise<PatientDocument[]> {
    const qb = this.docRepo
      .createQueryBuilder('doc')
      .where('doc.subject_id = :subjectId', { subjectId })
      .orderBy('doc.uploaded_at', 'DESC');

    if (filter?.scope === PatientDocumentScope.GENERAL) {
      qb.andWhere('doc.therapeutic_path_id IS NULL AND doc.treatment_id IS NULL');
    } else if (filter?.scope === PatientDocumentScope.PATH) {
      // Vista percorso: include anche i documenti dei suoi trattamenti
      // (percorso denormalizzato — nessuna join necessaria)
      if (filter.therapeuticPathId) {
        qb.andWhere('doc.therapeutic_path_id = :pathId', { pathId: filter.therapeuticPathId });
      } else {
        qb.andWhere('doc.therapeutic_path_id IS NOT NULL');
      }
    } else if (filter?.scope === PatientDocumentScope.TREATMENT) {
      if (filter.treatmentId) {
        qb.andWhere('doc.treatment_id = :treatmentId', { treatmentId: filter.treatmentId });
      } else {
        qb.andWhere('doc.treatment_id IS NOT NULL');
      }
    } else {
      // Nessuno scope: eventuali filtri diretti su percorso/trattamento
      if (filter?.therapeuticPathId) {
        qb.andWhere('doc.therapeutic_path_id = :pathId', { pathId: filter.therapeuticPathId });
      }
      if (filter?.treatmentId) {
        qb.andWhere('doc.treatment_id = :treatmentId', { treatmentId: filter.treatmentId });
      }
    }

    if (filter?.category) {
      qb.andWhere('doc.category = :category', { category: filter.category });
    }
    if (filter?.contentKind) {
      qb.andWhere('doc.content_kind = :kind', { kind: filter.contentKind });
    }
    if (filter?.search) {
      qb.andWhere(
        '(doc.original_file_name ILIKE :search OR doc.notes ILIKE :search OR doc.description ILIKE :search)',
        { search: `%${filter.search}%` },
      );
    }

    return qb.getMany();
  }

  async getStats(subjectId: string): Promise<PatientDocumentStats> {
    const docs = await this.docRepo.find({
      where: { subjectId },
      select: ['id', 'therapeuticPathId', 'treatmentId', 'category', 'contentKind'],
    });

    const byCategory = new Map<string, number>();
    const byKind = new Map<string, number>();
    const byPath = new Map<string, number>();
    let generalCount = 0;
    let pathCount = 0;
    let treatmentCount = 0;

    for (const doc of docs) {
      byCategory.set(doc.category, (byCategory.get(doc.category) || 0) + 1);
      byKind.set(doc.contentKind, (byKind.get(doc.contentKind) || 0) + 1);
      if (doc.treatmentId) treatmentCount++;
      else if (doc.therapeuticPathId) pathCount++;
      else generalCount++;
      if (doc.therapeuticPathId) {
        byPath.set(doc.therapeuticPathId, (byPath.get(doc.therapeuticPathId) || 0) + 1);
      }
    }

    return {
      total: docs.length,
      generalCount,
      pathCount,
      treatmentCount,
      byCategory: [...byCategory.entries()].map(([category, count]) => ({
        category: category as PatientDocumentCategory,
        count,
      })),
      byKind: [...byKind.entries()].map(([kind, count]) => ({
        kind: kind as PatientDocumentKind,
        count,
      })),
      byPath: [...byPath.entries()].map(([therapeuticPathId, count]) => ({
        therapeuticPathId,
        count,
      })),
    };
  }

  async getById(id: string): Promise<PatientDocument> {
    const doc = await this.docRepo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException(`Document ${id} not found`);
    return doc;
  }

  // ==================== UPDATE / DELETE / RESTORE / PURGE ====================

  async updateDocument(id: string, input: UpdatePatientDocumentInput): Promise<PatientDocument> {
    const doc = await this.getById(id);
    if (input.category !== undefined) doc.category = input.category;
    if (input.notes !== undefined) doc.notes = input.notes;
    if (input.description !== undefined) doc.description = input.description;
    if (input.externalDoctorName !== undefined) doc.externalDoctorName = input.externalDoctorName;
    return this.docRepo.save(doc);
  }

  /** Soft delete → il documento finisce nel cestino (recycle bin). */
  async softDeleteDocument(id: string): Promise<boolean> {
    await this.getById(id);
    await this.docRepo.softDelete(id);
    this.logger.log(`Document ${id} soft-deleted (tenant=${this.tenantAlias})`);
    return true;
  }

  /** Ripristino dal cestino. */
  async restoreDocument(id: string): Promise<boolean> {
    const doc = await this.docRepo.findOne({
      where: { id, deletedAt: Not(IsNull()) },
      withDeleted: true,
    });
    if (!doc) throw new NotFoundException(`Deleted document ${id} not found`);
    await this.docRepo.restore(id);
    return true;
  }

  /** Eliminazione definitiva: oggetto S3 + riga. */
  async purgeDocument(id: string): Promise<boolean> {
    const doc = await this.docRepo.findOne({ where: { id }, withDeleted: true });
    if (!doc) return false;
    await this.storage
      .deleteObject({ tenantAlias: this.tenantAlias, key: doc.objectKey })
      .catch((err) => {
        this.logger.warn(`Purge ${id}: S3 delete failed (${err?.message}), continuing`);
      });
    await this.docRepo.delete(id);
    this.logger.log(`Document ${id} purged (tenant=${this.tenantAlias})`);
    return true;
  }
}
