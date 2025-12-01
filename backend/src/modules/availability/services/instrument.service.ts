import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Instrument } from '../entities/instrument.entity';
import { InstrumentStatus } from '../entities/instrument-status.enum';

@Injectable()
export class InstrumentService {
  constructor(
    @InjectRepository(Instrument)
    private instrumentRepo: Repository<Instrument>,
  ) {}

  async findAll(categoryId?: string, status?: InstrumentStatus): Promise<Instrument[]> {
    const where: any = {};
    if (categoryId) where.categoryId = categoryId;
    if (status) where.status = status;

    return this.instrumentRepo.find({
      where,
      relations: ['category'],
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Instrument> {
    const instrument = await this.instrumentRepo.findOne({
      where: { id },
      relations: ['category'],
    });
    if (!instrument) {
      throw new NotFoundException(`Instrument with ID ${id} not found`);
    }
    return instrument;
  }

  async findAvailableByCategory(categoryId: string): Promise<Instrument[]> {
    return this.instrumentRepo.find({
      where: {
        categoryId,
        status: InstrumentStatus.ACTIVE,
        isActive: true,
      },
      relations: ['category'],
      order: { name: 'ASC' },
    });
  }

  async create(data: {
    categoryId: string;
    name: string;
    brand?: string;
    model?: string;
    verificationExpiry?: Date;
    technicalData?: Record<string, any>;
    color?: string;
  }): Promise<Instrument> {
    const instrument = this.instrumentRepo.create({
      ...data,
      status: InstrumentStatus.ACTIVE,
      isActive: true,
    });
    const saved = await this.instrumentRepo.save(instrument);
    // Reload with category relation
    return this.findOne(saved.id);
  }

  async update(
    id: string,
    data: Partial<Pick<Instrument, 'name' | 'brand' | 'model' | 'verificationExpiry' | 'status' | 'technicalData' | 'color' | 'isActive' | 'categoryId'>>,
  ): Promise<Instrument> {
    await this.instrumentRepo.update(id, data);
    return this.findOne(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.instrumentRepo.delete(id);
    return result.affected ? result.affected > 0 : false;
  }

  async setStatus(id: string, status: InstrumentStatus): Promise<Instrument> {
    await this.instrumentRepo.update(id, { status });
    return this.findOne(id);
  }
}
