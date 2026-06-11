import { Injectable, NotFoundException } from '@nestjs/common';
import { PatientAnamnesis } from '../entities/patient-anamnesis.entity';
import {
  CreatePatientAnamnesisInput,
  UpdatePatientAnamnesisInput,
} from '../dto/patient-anamnesis.input';
import { TenantContextService } from '@curandis/tenant-datasource';

/**
 * PatientAnamnesisService — CRUD anamnesi e dati sanitari "anagrafici"
 * del paziente.
 *
 * Relazione 1:1 col subject del registry (subjectId UUID).
 */
@Injectable()
export class PatientAnamnesisService {
  constructor(
    private readonly tenantContext: TenantContextService,
  ){}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get anamnesisRepository() { return this.dataSource.getRepository(PatientAnamnesis); }

  // ==================== QUERIES ====================

  async findById(id: string): Promise<PatientAnamnesis | null> {
    return this.anamnesisRepository.findOne({
      where: { id },
      relations: ['operator'],
    });
  }

  /** Trova l'anamnesi per il subjectId (UUID del paziente nel registry). */
  async findBySubjectId(subjectId: string): Promise<PatientAnamnesis | null> {
    return this.anamnesisRepository.findOne({
      where: { subjectId },
      relations: ['operator'],
    });
  }

  async existsForSubject(subjectId: string): Promise<boolean> {
    const count = await this.anamnesisRepository.count({
      where: { subjectId },
    });
    return count > 0;
  }

  // ==================== MUTATIONS ====================

  /**
   * Crea una nuova anamnesi per un paziente.
   * Ogni paziente può avere una sola anamnesi (relazione 1:1).
   */
  async create(input: CreatePatientAnamnesisInput): Promise<PatientAnamnesis> {
    const existing = await this.findBySubjectId(input.subjectId);
    if (existing) {
      throw new Error(
        `Il paziente ${input.subjectId} ha già un'anamnesi. Usa update invece di create.`,
      );
    }

    const anamnesis = this.anamnesisRepository.create({
      subjectId: input.subjectId,
      operatorId: input.operatorId,
      patologiePregresse: input.patologiePregresse,
      interventiChirurgici: input.interventiChirurgici,
      traumi: input.traumi,
      terapiaFarmacologica: input.terapiaFarmacologica || [],
      allergie: input.allergie,
      storiaFamiliare: input.storiaFamiliare,
      gruppoSanguigno: input.gruppoSanguigno,
      medicoBase: input.medicoBase,
      patologieCroniche: input.patologieCroniche,
      note: input.note,
    });

    const saved = await this.anamnesisRepository.save(anamnesis);
    return this.findById(saved.id) as Promise<PatientAnamnesis>;
  }

  async update(id: string, input: UpdatePatientAnamnesisInput): Promise<PatientAnamnesis> {
    const anamnesis = await this.findById(id);
    if (!anamnesis) {
      throw new NotFoundException(`Anamnesi con ID ${id} non trovata`);
    }

    if (input.operatorId !== undefined) anamnesis.operatorId = input.operatorId;
    if (input.patologiePregresse !== undefined) anamnesis.patologiePregresse = input.patologiePregresse;
    if (input.interventiChirurgici !== undefined) anamnesis.interventiChirurgici = input.interventiChirurgici;
    if (input.traumi !== undefined) anamnesis.traumi = input.traumi;
    if (input.terapiaFarmacologica !== undefined) anamnesis.terapiaFarmacologica = input.terapiaFarmacologica;
    if (input.allergie !== undefined) anamnesis.allergie = input.allergie;
    if (input.storiaFamiliare !== undefined) anamnesis.storiaFamiliare = input.storiaFamiliare;
    if (input.gruppoSanguigno !== undefined) anamnesis.gruppoSanguigno = input.gruppoSanguigno;
    if (input.medicoBase !== undefined) anamnesis.medicoBase = input.medicoBase;
    if (input.patologieCroniche !== undefined) anamnesis.patologieCroniche = input.patologieCroniche;
    if (input.note !== undefined) anamnesis.note = input.note;

    await this.anamnesisRepository.save(anamnesis);
    return this.findById(id) as Promise<PatientAnamnesis>;
  }

  /** Aggiorna o crea l'anamnesi per un subject (upsert). */
  async upsert(subjectId: string, input: UpdatePatientAnamnesisInput): Promise<PatientAnamnesis> {
    const existing = await this.findBySubjectId(subjectId);
    if (existing) {
      return this.update(existing.id, input);
    }
    return this.create({ subjectId, ...input });
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.anamnesisRepository.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async deleteBySubjectId(subjectId: string): Promise<boolean> {
    const result = await this.anamnesisRepository.delete({ subjectId });
    return (result.affected ?? 0) > 0;
  }
}
