import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PatientAnamnesis } from '../entities/patient-anamnesis.entity';
import {
  CreatePatientAnamnesisInput,
  UpdatePatientAnamnesisInput,
} from '../dto/patient-anamnesis.input';

/**
 * PatientAnamnesisService
 *
 * Gestisce le operazioni CRUD per l'anamnesi del paziente.
 * Relazione 1:1 con Patient.
 */
@Injectable()
export class PatientAnamnesisService {
  constructor(
    @InjectRepository(PatientAnamnesis)
    private readonly anamnesisRepository: Repository<PatientAnamnesis>,
  ) {}

  // ==================== QUERIES ====================

  /**
   * Trova l'anamnesi per ID
   */
  async findById(id: string): Promise<PatientAnamnesis | null> {
    return this.anamnesisRepository.findOne({
      where: { id },
      relations: ['patient', 'operator'],
    });
  }

  /**
   * Trova l'anamnesi per paziente ID
   */
  async findByPatientId(patientId: string): Promise<PatientAnamnesis | null> {
    return this.anamnesisRepository.findOne({
      where: { patientId },
      relations: ['patient', 'operator'],
    });
  }

  /**
   * Verifica se un paziente ha già un'anamnesi
   */
  async existsForPatient(patientId: string): Promise<boolean> {
    const count = await this.anamnesisRepository.count({
      where: { patientId },
    });
    return count > 0;
  }

  // ==================== MUTATIONS ====================

  /**
   * Crea una nuova anamnesi per un paziente
   * Ogni paziente può avere una sola anamnesi (relazione 1:1)
   */
  async create(input: CreatePatientAnamnesisInput): Promise<PatientAnamnesis> {
    // Verifica se esiste già un'anamnesi per questo paziente
    const existing = await this.findByPatientId(input.patientId);
    if (existing) {
      throw new Error(`Il paziente ${input.patientId} ha già un'anamnesi. Usa update invece di create.`);
    }

    const anamnesis = this.anamnesisRepository.create({
      patientId: input.patientId,
      operatorId: input.operatorId,
      patologiePregresse: input.patologiePregresse,
      interventiChirurgici: input.interventiChirurgici,
      traumi: input.traumi,
      terapiaFarmacologica: input.terapiaFarmacologica || [],
      allergie: input.allergie,
      storiaFamiliare: input.storiaFamiliare,
      note: input.note,
    });

    const saved = await this.anamnesisRepository.save(anamnesis);

    // Ricarica con relazioni
    return this.findById(saved.id) as Promise<PatientAnamnesis>;
  }

  /**
   * Aggiorna un'anamnesi esistente
   */
  async update(id: string, input: UpdatePatientAnamnesisInput): Promise<PatientAnamnesis> {
    const anamnesis = await this.findById(id);
    if (!anamnesis) {
      throw new NotFoundException(`Anamnesi con ID ${id} non trovata`);
    }

    // Aggiorna i campi forniti
    if (input.operatorId !== undefined) anamnesis.operatorId = input.operatorId;
    if (input.patologiePregresse !== undefined) anamnesis.patologiePregresse = input.patologiePregresse;
    if (input.interventiChirurgici !== undefined) anamnesis.interventiChirurgici = input.interventiChirurgici;
    if (input.traumi !== undefined) anamnesis.traumi = input.traumi;
    if (input.terapiaFarmacologica !== undefined) anamnesis.terapiaFarmacologica = input.terapiaFarmacologica;
    if (input.allergie !== undefined) anamnesis.allergie = input.allergie;
    if (input.storiaFamiliare !== undefined) anamnesis.storiaFamiliare = input.storiaFamiliare;
    if (input.note !== undefined) anamnesis.note = input.note;

    await this.anamnesisRepository.save(anamnesis);

    // Ricarica con relazioni
    return this.findById(id) as Promise<PatientAnamnesis>;
  }

  /**
   * Aggiorna o crea l'anamnesi per un paziente (upsert)
   */
  async upsert(patientId: string, input: UpdatePatientAnamnesisInput): Promise<PatientAnamnesis> {
    const existing = await this.findByPatientId(patientId);

    if (existing) {
      return this.update(existing.id, input);
    } else {
      return this.create({
        patientId,
        ...input,
      });
    }
  }

  /**
   * Elimina un'anamnesi
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.anamnesisRepository.delete(id);
    return (result.affected ?? 0) > 0;
  }

  /**
   * Elimina l'anamnesi di un paziente
   */
  async deleteByPatientId(patientId: string): Promise<boolean> {
    const result = await this.anamnesisRepository.delete({ patientId });
    return (result.affected ?? 0) > 0;
  }
}
