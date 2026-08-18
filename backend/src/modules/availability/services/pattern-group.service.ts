import { Injectable, NotFoundException, BadRequestException, ConflictException, Inject, forwardRef } from '@nestjs/common';
import { PatternGroup } from '../entities/pattern-group.entity';
import { TemplatePattern } from '../entities/template-pattern.entity';
import { TemplateAssignment } from '../entities/template-assignment.entity';
import { TemplateAssignmentRoomOverride } from '../entities/template-assignment-room-override.entity';
import { CreatePatternGroupInput } from '../dto/create-pattern-group.input';
import { UpdatePatternGroupInput } from '../dto/update-pattern-group.input';
import { ConflictCheckResult } from './appointment-conflict.service';
import { AvailabilityService } from './availability.service';
import { TenantContextService } from '@curandis/tenant-datasource';
import { toDateString } from '../utils/date-string.util';

/**
 * Risultato dell'update con informazioni sui conflitti
 */
export interface PatternGroupUpdateResult {
  patternGroup: PatternGroup;
  conflicts: ConflictCheckResult;
  /** Override studio/poltrona rimasti orfani (fascia/giorno rimossi) ed eliminati */
  removedRoomOverrides: number;
}

@Injectable()
export class PatternGroupService {
  constructor(
    private readonly tenantContext: TenantContextService,
    @Inject(forwardRef(() => AvailabilityService))
    private availabilityService: AvailabilityService,
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

    // Operatori con questo template nella loro timeline: le fasce sono
    // cambiate, quindi (a) la cache di disponibilità va ricostruita e
    // (b) gli appuntamenti futuri vanno riconfrontati con le fasce reali.
    const assignedOps = await this.assignmentRepo.find({
      select: ['operatorId'],
      where: { patternGroupId: id, isCurrent: true },
    });
    const operatorIds = [...new Set(assignedOps.map((a) => a.operatorId))];

    const todayStr = toDateString(new Date());
    const cacheEnd = new Date(new Date().setFullYear(new Date().getFullYear() + 1))
      .toISOString()
      .split('T')[0];
    for (const opId of operatorIds) {
      await this.availabilityService.rebuildCache(opId, todayStr, cacheEnd);
    }

    // Verifica conflitti reali contro le fasce per-data (timeline completa
    // dell'operatore, non marcatura in blocco): con markConflicts=false è un
    // dry-run che riporta i conflitti senza flaggarli.
    const marked = await this.availabilityService.detectAndMarkTemplateConflicts(
      operatorIds,
      markConflicts,
    );
    const conflicts: ConflictCheckResult = {
      hasConflicts: marked.length > 0,
      conflicts: marked.map((apt) => ({
        appointment: apt,
        reason: 'Modifica al template di disponibilità',
        sourceType: 'template_change' as const,
        sourceId: id,
      })),
      totalCount: marked.length,
    };

    const patternGroup = await this.findOne(id);

    // Guardia studi: gli override studio/poltrona che si riferiscono a
    // giorni/fasce che non esistono più nel template modificato vengono
    // eliminati (e segnalati al chiamante per l'avviso in UI).
    const removedRoomOverrides = await this.cleanupOrphanRoomOverrides(id, patternGroup);

    return { patternGroup, conflicts, removedRoomOverrides };
  }

  /**
   * Elimina gli override studio/poltrona delle assegnazioni di questo
   * template che non intersecano più nessuna fascia: giorno fuori dalla
   * durata, giorno senza fasce, o finestra oraria che non tocca più nulla.
   * Gli override giornalieri (senza orario) restano finché il giorno ha fasce.
   */
  private async cleanupOrphanRoomOverrides(
    patternGroupId: string,
    patternGroup: PatternGroup,
  ): Promise<number> {
    const overrideRepo = this.dataSource.getRepository(TemplateAssignmentRoomOverride);
    const overrides = await overrideRepo
      .createQueryBuilder('o')
      .innerJoin('o.assignment', 'a')
      .where('a.patternGroupId = :patternGroupId', { patternGroupId })
      .getMany();
    if (overrides.length === 0) return 0;

    const toMin = (t: string) => {
      const [h, m] = String(t).split(':');
      return parseInt(h, 10) * 60 + parseInt(m || '0', 10);
    };
    const bandsByDay = new Map<number, { start: number; end: number }[]>();
    for (const p of patternGroup.patterns ?? []) {
      if (!bandsByDay.has(p.dayInPattern)) bandsByDay.set(p.dayInPattern, []);
      bandsByDay.get(p.dayInPattern)!.push({
        start: toMin(p.startTime),
        end: toMin(p.endTime),
      });
    }

    const orphanIds = overrides
      .filter((o) => {
        if (o.dayInPattern >= patternGroup.patternDuration) return true;
        const bands = bandsByDay.get(o.dayInPattern) ?? [];
        if (bands.length === 0) return true;
        if (!o.startTime || !o.endTime) return false;
        const s = toMin(o.startTime);
        const e = toMin(o.endTime);
        return !bands.some((b) => b.start < e && b.end > s);
      })
      .map((o) => o.id);

    if (orphanIds.length > 0) {
      await overrideRepo.delete(orphanIds);
    }
    return orphanIds.length;
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
