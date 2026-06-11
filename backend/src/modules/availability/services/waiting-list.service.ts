import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { In } from 'typeorm';
import { WaitingListEntry, WaitingListStatus } from '../entities/waiting-list-entry.entity';
import { CreateWaitingListEntryInput } from '../dto/waiting-list.input';
import { UpdateWaitingListEntryInput } from '../dto/waiting-list.input';
import { TenantContextService } from '@curandis/tenant-datasource';

@Injectable()
export class WaitingListService {
  private readonly logger = new Logger(WaitingListService.name);

  constructor(
    private readonly tenantContext: TenantContextService,
  ){}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get waitingListRepo() { return this.dataSource.getRepository(WaitingListEntry); }

  async findAll(status?: WaitingListStatus): Promise<WaitingListEntry[]> {
    const where: Record<string, WaitingListStatus> = {};
    if (status) {
      where.status = status;
    }

    return this.waitingListRepo.find({
      where,
      relations: ['operator'],
      order: { priority: 'DESC', position: 'ASC' },
    });
  }

  async findById(id: string): Promise<WaitingListEntry> {
    const entry = await this.waitingListRepo.findOne({
      where: { id },
      relations: ['operator'],
    });

    if (!entry) {
      throw new NotFoundException(`Voce lista d'attesa con ID ${id} non trovata`);
    }

    return entry;
  }

  async create(input: CreateWaitingListEntryInput): Promise<WaitingListEntry> {
    // Auto-assign next position
    const maxPosition = await this.waitingListRepo
      .createQueryBuilder('wl')
      .select('COALESCE(MAX(wl.position), -1)', 'maxPos')
      .where('wl.status = :status', { status: WaitingListStatus.WAITING })
      .getRawOne();

    const nextPosition = (maxPosition?.maxPos ?? -1) + 1;

    const entry = this.waitingListRepo.create({
      ...input,
      position: nextPosition,
      status: WaitingListStatus.WAITING,
    });

    const saved = await this.waitingListRepo.save(entry);
    return this.findById(saved.id);
  }

  async update(id: string, input: UpdateWaitingListEntryInput): Promise<WaitingListEntry> {
    const entry = await this.findById(id);
    Object.assign(entry, input);
    await this.waitingListRepo.save(entry);
    return this.findById(id);
  }

  async remove(id: string): Promise<boolean> {
    const entry = await this.findById(id);
    await this.waitingListRepo.remove(entry);
    return true;
  }

  async reorder(entries: { id: string; position: number }[]): Promise<WaitingListEntry[]> {
    await this.waitingListRepo.manager.transaction(async (manager) => {
      for (const item of entries) {
        await manager.update(WaitingListEntry, item.id, { position: item.position });
      }
    });

    const ids = entries.map(e => e.id);
    return this.waitingListRepo.find({
      where: { id: In(ids) },
      relations: ['operator'],
      order: { position: 'ASC' },
    });
  }
}
