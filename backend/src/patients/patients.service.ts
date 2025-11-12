import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Patient } from '../entities/patient.entity';

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private patientsRepository: Repository<Patient>,
  ) {}

  findAll(): Promise<Patient[]> {
    return this.patientsRepository.find({
      order: { surname: 'ASC', name: 'ASC' }
    });
  }

  search(query: string): Promise<Patient[]> {
    return this.patientsRepository.find({
      where: [
        { name: Like(`%${query}%`) },
        { surname: Like(`%${query}%`) },
        { phone: Like(`%${query}%`) }
      ],
      order: { surname: 'ASC', name: 'ASC' }
    });
  }

  findOne(id: number): Promise<Patient> {
    return this.patientsRepository.findOne({ where: { id } });
  }

  create(patientData: Partial<Patient>): Promise<Patient> {
    const patient = this.patientsRepository.create(patientData);
    return this.patientsRepository.save(patient);
  }

  async update(id: number, patientData: Partial<Patient>): Promise<Patient> {
    await this.patientsRepository.update(id, patientData);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.patientsRepository.delete(id);
  }
}
