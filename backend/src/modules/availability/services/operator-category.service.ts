import { Injectable, NotFoundException } from '@nestjs/common';
import { OperatorCategory } from '../entities/operator-category.entity';
import { OperatorMacroCategory } from '../entities/operator-macro-category.enum';
import { TenantContextService } from '@curandis/tenant-datasource';

@Injectable()
export class OperatorCategoryService {
  constructor(
    private readonly tenantContext: TenantContextService,
  ){}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get categoryRepo() { return this.dataSource.getRepository(OperatorCategory); }

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
