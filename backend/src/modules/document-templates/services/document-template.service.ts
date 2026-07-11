import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '@curandis/tenant-datasource';
import {
  DocumentTemplate,
  DocumentTemplateType,
} from '../entities/document-template.entity';
import {
  CreateDocumentTemplateInput,
  UpdateDocumentTemplateInput,
} from '../dto/document-template.input';

@Injectable()
export class DocumentTemplateService {
  constructor(private readonly tenantContext: TenantContextService) {}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get repo() {
    return this.dataSource.getRepository(DocumentTemplate);
  }

  async findAll(type?: DocumentTemplateType): Promise<DocumentTemplate[]> {
    return this.repo.find({
      where: type ? { type } : {},
      order: { isDefault: 'DESC', name: 'ASC' },
    });
  }

  async findById(id: string): Promise<DocumentTemplate | null> {
    return this.repo.findOne({ where: { id } });
  }

  /**
   * Template usato dall'azione rapida "Genera attestato": il default del
   * tipo, oppure l'unico esistente se nessuno è marcato default.
   */
  async findDefaultByType(
    type: DocumentTemplateType,
  ): Promise<DocumentTemplate | null> {
    const all = await this.findAll(type);
    if (all.length === 0) return null;
    return all.find((t) => t.isDefault) ?? all[0];
  }

  async create(input: CreateDocumentTemplateInput): Promise<DocumentTemplate> {
    const type = input.type ?? DocumentTemplateType.ATTENDANCE_CERTIFICATE;
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(DocumentTemplate);
      // Il primo template di un tipo diventa automaticamente default
      const existing = await repo.count({ where: { type } });
      const isDefault = input.isDefault ?? existing === 0;
      if (isDefault) {
        await repo.update({ type }, { isDefault: false });
      }
      const template = repo.create({ ...input, type, isDefault });
      return repo.save(template);
    });
  }

  async update(
    id: string,
    input: UpdateDocumentTemplateInput,
  ): Promise<DocumentTemplate> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(DocumentTemplate);
      const template = await repo.findOne({ where: { id } });
      if (!template) {
        throw new NotFoundException(`Template ${id} non trovato`);
      }
      if (input.isDefault === true) {
        await repo.update({ type: template.type }, { isDefault: false });
      }
      Object.assign(template, input);
      return repo.save(template);
    });
  }

  async delete(id: string): Promise<boolean> {
    const template = await this.repo.findOne({ where: { id } });
    if (!template) {
      throw new NotFoundException(`Template ${id} non trovato`);
    }
    await this.repo.remove(template);
    // Se era il default, promuovi il primo rimasto dello stesso tipo
    if (template.isDefault) {
      const next = await this.repo.findOne({
        where: { type: template.type },
        order: { name: 'ASC' },
      });
      if (next) {
        next.isDefault = true;
        await this.repo.save(next);
      }
    }
    return true;
  }
}
