import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InstrumentCategory } from '../entities/instrument-category.entity';
import { OperatorMacroCategory } from '../entities/operator-macro-category.enum';

@Injectable()
export class InstrumentCategoryService {
  constructor(
    @InjectRepository(InstrumentCategory)
    private categoryRepo: Repository<InstrumentCategory>,
  ) {}

  async findAll(macroCategory?: OperatorMacroCategory): Promise<InstrumentCategory[]> {
    const where = macroCategory ? { macroCategory } : {};
    return this.categoryRepo.find({
      where,
      relations: ['instruments'],
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<InstrumentCategory> {
    const category = await this.categoryRepo.findOne({
      where: { id },
      relations: ['instruments'],
    });
    if (!category) {
      throw new NotFoundException(`InstrumentCategory with ID ${id} not found`);
    }
    return category;
  }

  async create(
    name: string,
    description?: string,
    macroCategory: OperatorMacroCategory = OperatorMacroCategory.PHYSIOTHERAPIST,
  ): Promise<InstrumentCategory> {
    const category = this.categoryRepo.create({
      macroCategory,
      name,
      description,
      isActive: true,
    });
    return this.categoryRepo.save(category);
  }

  async update(
    id: string,
    data: Partial<Pick<InstrumentCategory, 'name' | 'description' | 'macroCategory' | 'isActive'>>,
  ): Promise<InstrumentCategory> {
    await this.categoryRepo.update(id, data);
    return this.findOne(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.categoryRepo.delete(id);
    return result.affected ? result.affected > 0 : false;
  }
}
