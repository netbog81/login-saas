import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OperatorCategory } from '../entities/operator-category.entity';
import { OperatorMacroCategory } from '../entities/operator-macro-category.enum';

@Injectable()
export class OperatorCategoryService {
  constructor(
    @InjectRepository(OperatorCategory)
    private categoryRepo: Repository<OperatorCategory>,
  ) {}

  async findAll(macroCategory?: OperatorMacroCategory): Promise<OperatorCategory[]> {
    const where = macroCategory ? { macroCategory } : {};
    return this.categoryRepo.find({
      where,
      relations: ['operators'],
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<OperatorCategory> {
    const category = await this.categoryRepo.findOne({
      where: { id },
      relations: ['operators'],
    });
    if (!category) {
      throw new NotFoundException(`OperatorCategory with ID ${id} not found`);
    }
    return category;
  }

  async create(
    macroCategory: OperatorMacroCategory,
    name: string,
    description?: string,
  ): Promise<OperatorCategory> {
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
    data: Partial<Pick<OperatorCategory, 'name' | 'description' | 'macroCategory' | 'isActive'>>,
  ): Promise<OperatorCategory> {
    await this.categoryRepo.update(id, data);
    return this.findOne(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.categoryRepo.delete(id);
    return result.affected ? result.affected > 0 : false;
  }
}
