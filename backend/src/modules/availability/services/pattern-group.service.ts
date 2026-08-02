import { Injectable, NotFoundException, BadRequestException, ConflictException, Inject, forwardRef } from '@nestjs/common';
import { PatternGroup } from '../entities/pattern-group.entity';
import { TemplatePattern } from '../entities/template-pattern.entity';
import { TemplateAssignment } from '../entities/template-assignment.entity';
import { CreatePatternGroupInput } from '../dto/create-pattern-group.input';
import { UpdatePatternGroupInput } from '../dto/update-pattern-group.input';
import { AppointmentConflictService, ConflictCheckResult } from './appointment-conflict.service';
import { TenantContextService } from '@curandis/tenant-datasource';

/**
 * Risultato dell'update con informazioni sui conflitti
 */
export interface PatternGroupUpdateResult {
  patternGroup: PatternGroup;
  conflicts: ConflictCheckResult;
}

@Injectable()
export class PatternGroupService {
  constructor(
    private readonly tenantContext: TenantContextService,
    @Inject(forwardRef(() => AppointmentConflictService))
    private conflictService: AppointmentConflictService,
  ){}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get patternGroupRepo() { return this.dataSource.getRepository(PatternGroup); }

  private get patternRepo() { return this.dataSource.getRepository(TemplatePattern); }

  private get assignmentRepo() { return this.dataSource.getRepository(TemplateAssignment); }

  async findAll(): Promise<PatternGroup[]> {
    return this.patternGroupRepo.find({
      relations: ['patterns'],
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<PatternGroup> {
    const group = await this.patternGroupRepo.findOne({
      where: { id },
      relations: ['patterns'],
    });

    if (!group) {
      throw new NotFoundException(`Pattern group with ID ${id} not found`);
    }

    return group;
  }

  async create(input: CreatePatternGroupInput): Promise<PatternGroup> {
    if (!input.patterns || input.patterns.length === 0) {
      throw new BadRequestException(
        'Il template deve avere almeno una fascia oraria'
      );
    }

    // Validate pattern duration consistency
    for (const pattern of input.patterns) {
      if (pattern.dayInPattern < 0 || pattern.dayInPattern >= input.patternDuration) {
        throw new BadRequestException(
          `dayInPattern must be between 0 and ${input.patternDuration - 1}`
        );
      }
    }

    // Gruppo e fasce nella stessa transazione: un fallimento sul save delle
    // fasce non deve lasciare in giro un gruppo "guscio vuoto" (invisibile
    // nell'elenco template ma assegnabile agli operatori).
    const savedGroup = await this.dataSource.transaction(async (manager) => {
      const group = manager.getRepository(PatternGroup).create({
        name: input.name,
        description: input.description,
        patternDuration: input.patternDuration,
        isActive: true,
      });

      const saved = await manager.getRepository(PatternGroup).save(group);

      const patterns = input.patterns.map(p =>
        manager.getRepository(TemplatePattern).create({
          ...p,
          patternGroupId: saved.id,
          patternDuration: input.patternDuration,
        })
      );

      await manager.getRepository(TemplatePattern).save(patterns);

      return saved;
    });

    // Reload with relations
    return this.findOne(savedGroup.id);
  }

  /**
   * Aggiorna un pattern group
   * Verifica automaticamente i conflitti con appuntamenti esistenti
   */
  async update(
    id: string,
    input: UpdatePatternGroupInput
  ): Promise<PatternGroup> {
    const result = await this.updateWithConflictCheck(id, input);
    return result.patternGroup;
  }

  /**
   * Aggiorna un pattern group e ritorna info sui conflitti
   * Usato dal resolver per comunicare i conflitti al frontend
   */
  async updateWithConflictCheck(
    id: string,
    input: UpdatePatternGroupInput,
    markConflicts: boolean = true
  ): Promise<PatternGroupUpdateResult> {
    const group = await this.findOne(id);

    // Un update non può svuotare il template: un gruppo senza fasce orarie
    // azzererebbe la disponibilità degli operatori assegnati. Per "spegnere"
    // un template esiste setActive(false).
    if (input.patterns && input.patterns.length === 0) {
      throw new BadRequestException(
        'Il template deve avere almeno una fascia oraria. Per non usarlo più, disattivalo invece di svuotarlo.'
      );
    }

    if (input.name !== undefined) group.name = input.name;
    if (input.description !== undefined) group.description = input.description;
    if (input.patternDuration !== undefined) {
      group.patternDuration = input.patternDuration;
    }

    if (input.patterns) {
      // Validate pattern duration consistency
      for (const pattern of input.patterns) {
        if (
          pattern.dayInPattern < 0 ||
          pattern.dayInPattern >= group.patternDuration
        ) {
          throw new BadRequestException(
            `dayInPattern must be between 0 and ${group.patternDuration - 1}`
          );
        }
      }
    }

    // Update gruppo + replace fasce nella stessa transazione: un fallimento a
    // metà (fasce cancellate ma non ricreate) lascerebbe un guscio vuoto.
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(PatternGroup).save(group);

      if (input.patterns) {
        await manager.getRepository(TemplatePattern).delete({ patternGroupId: id });

        const patterns = input.patterns.map(p =>
          manager.getRepository(TemplatePattern).create({
            ...p,
            patternGroupId: id,
            patternDuration: group.patternDuration,
          })
        );

        await manager.getRepository(TemplatePattern).save(patterns);
      }
    });

    // Verifica conflitti con appuntamenti esistenti
    const conflicts = await this.conflictService.checkConflictsOnTemplateChange(id);

    // Se ci sono conflitti e markConflicts è true, marca gli appuntamenti
    if (conflicts.hasConflicts && markConflicts) {
      const appointmentIds = conflicts.conflicts.map(c => c.appointment.id);
      await this.conflictService.markTemplateConflicts(appointmentIds);
    }

    const patternGroup = await this.findOne(id);
    return { patternGroup, conflicts };
  }

  async delete(id: string): Promise<boolean> {
    // Check if pattern group exists
    const group = await this.patternGroupRepo.findOne({ where: { id } });
    if (!group) {
      throw new NotFoundException(`Pattern group with ID ${id} not found`);
    }

    // Check if pattern group has active assignments
    const assignmentCount = await this.assignmentRepo.count({
      where: { patternGroupId: id, isCurrent: true }
    });

    if (assignmentCount > 0) {
      throw new ConflictException(
        `Impossibile eliminare il template: è attualmente assegnato a ${assignmentCount} operatore/i. ` +
        `Rimuovi prima le assegnazioni.`
      );
    }

    // La FK di template_assignments è RESTRICT: con assegnazioni storiche
    // (isCurrent=false) il DELETE fallirebbe con un errore DB grezzo. Meglio
    // un messaggio chiaro che indirizzi alla disattivazione.
    const historicalCount = await this.assignmentRepo.count({
      where: { patternGroupId: id }
    });

    if (historicalCount > 0) {
      throw new ConflictException(
        `Impossibile eliminare il template: ha ${historicalCount} assegnazioni storiche a operatori. ` +
        `Disattivalo per non renderlo più assegnabile.`
      );
    }

    const result = await this.patternGroupRepo.delete(id);
    return result.affected ? result.affected > 0 : false;
  }

  async setActive(id: string, isActive: boolean): Promise<PatternGroup> {
    const group = await this.findOne(id);
    group.isActive = isActive;
    await this.patternGroupRepo.save(group);
    return this.findOne(id);
  }
}
