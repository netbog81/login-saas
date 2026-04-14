import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { OperatorAbsenceType } from '../entities/operator-absence-type.entity';
import {
  CreateOperatorAbsenceTypeInput,
  UpdateOperatorAbsenceTypeInput,
} from '../dto/operator-absence-type.input';

@Injectable()
export class OperatorAbsenceTypeService {
  constructor(
    @InjectRepository(OperatorAbsenceType)
    private absenceTypeRepo: Repository<OperatorAbsenceType>,
  ) {}

  async findAll(onlyActive?: boolean): Promise<OperatorAbsenceType[]> {
    const where = onlyActive ? { isActive: true } : {};
    return this.absenceTypeRepo.find({
      where,
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<OperatorAbsenceType> {
    const type = await this.absenceTypeRepo.findOne({ where: { id } });
    if (!type) {
      throw new NotFoundException(`Tipo di assenza con ID ${id} non trovato`);
    }
    return type;
  }

  /**
   * Soft-lookup by id che non lancia eccezioni: usato dal GymExceptionService
   * per costruire lo snapshot senza rompere il flusso se il tipo non esiste.
   */
  async findOneOrNull(id: string): Promise<OperatorAbsenceType | null> {
    return this.absenceTypeRepo.findOne({ where: { id } });
  }

  async create(input: CreateOperatorAbsenceTypeInput): Promise<OperatorAbsenceType> {
    // Vincolo univocità nome (case-insensitive)
    const existing = await this.absenceTypeRepo.findOne({
      where: { name: ILike(input.name.trim()) },
    });
    if (existing) {
      throw new ConflictException(
        `Esiste già un tipo di assenza con nome "${input.name}"`,
      );
    }

    const entity = this.absenceTypeRepo.create({
      name: input.name.trim(),
      description: input.description,
      isActive: true,
    });
    return this.absenceTypeRepo.save(entity);
  }

  async update(
    id: string,
    input: UpdateOperatorAbsenceTypeInput,
  ): Promise<OperatorAbsenceType> {
    const existing = await this.findOne(id);

    if (input.name !== undefined && input.name.trim() !== existing.name) {
      const clash = await this.absenceTypeRepo.findOne({
        where: { name: ILike(input.name.trim()) },
      });
      if (clash && clash.id !== id) {
        throw new ConflictException(
          `Esiste già un tipo di assenza con nome "${input.name}"`,
        );
      }
      existing.name = input.name.trim();
    }
    if (input.description !== undefined) existing.description = input.description;
    if (input.isActive !== undefined) existing.isActive = input.isActive;

    return this.absenceTypeRepo.save(existing);
  }

  /**
   * Hard delete. Le GymException che referenziavano questo tipo mantengono
   * lo snapshot salvato al momento della creazione, quindi nessuna perdita
   * di informazioni storiche.
   */
  async delete(id: string): Promise<boolean> {
    await this.findOne(id); // valida che esista
    const result = await this.absenceTypeRepo.delete(id);
    return result.affected ? result.affected > 0 : false;
  }
}
