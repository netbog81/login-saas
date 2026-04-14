import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { GymPatternGroup } from '../entities/gym-pattern-group.entity';
import { GymTemplatePattern } from '../entities/gym-template-pattern.entity';
import { GymRoom } from '../entities/gym-room.entity';
import { Operator } from '../entities/operator.entity';
import { OperatorMacroCategory } from '../entities/operator-macro-category.enum';

export interface CreateGymPatternGroupInput {
  gymRoomId: string;
  name: string;
  description?: string;
  patternDuration?: number;
  patternStartDate: Date;
  validFrom: Date;
  validUntil?: Date;
  patterns: CreateGymTemplatePatternInput[];
}

export interface CreateGymTemplatePatternInput {
  operatorId: string;
  dayInPattern: number;
  startTime: string;
  endTime: string;
}

export interface UpdateGymPatternGroupInput {
  name?: string;
  description?: string;
  patternDuration?: number;
  patternStartDate?: Date;
  validFrom?: Date;
  validUntil?: Date;
  isActive?: boolean;
  patterns?: CreateGymTemplatePatternInput[];
}

@Injectable()
export class GymPatternGroupService {
  constructor(
    @InjectRepository(GymPatternGroup)
    private patternGroupRepo: Repository<GymPatternGroup>,
    @InjectRepository(GymTemplatePattern)
    private patternRepo: Repository<GymTemplatePattern>,
    @InjectRepository(GymRoom)
    private gymRoomRepo: Repository<GymRoom>,
    @InjectRepository(Operator)
    private operatorRepo: Repository<Operator>,
  ) {}

  /**
   * Trova tutti i template di una palestra
   */
  async findAll(gymRoomId?: string): Promise<GymPatternGroup[]> {
    const where = gymRoomId ? { gymRoomId } : {};
    return this.patternGroupRepo.find({
      where,
      relations: ['patterns', 'patterns.operator', 'gymRoom'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Trova un template per ID
   */
  async findOne(id: string): Promise<GymPatternGroup> {
    const group = await this.patternGroupRepo.findOne({
      where: { id },
      relations: ['patterns', 'patterns.operator', 'gymRoom'],
    });

    if (!group) {
      throw new NotFoundException(`Template palestra con ID ${id} non trovato`);
    }

    return group;
  }

  /**
   * Trova il template corrente (attivo) per una palestra
   */
  async findCurrentByGymRoom(gymRoomId: string): Promise<GymPatternGroup | null> {
    return this.patternGroupRepo.findOne({
      where: { gymRoomId, isCurrent: true, isActive: true },
      relations: ['patterns', 'patterns.operator', 'gymRoom'],
    });
  }

  /**
   * Crea un nuovo template per la palestra
   */
  async create(input: CreateGymPatternGroupInput): Promise<GymPatternGroup> {
    // Verifica che la palestra esista
    const gymRoom = await this.gymRoomRepo.findOne({ where: { id: input.gymRoomId } });
    if (!gymRoom) {
      throw new NotFoundException(`Palestra con ID ${input.gymRoomId} non trovata`);
    }

    const patternDuration = input.patternDuration || 7;

    // Valida i pattern
    await this.validatePatterns(input.patterns, patternDuration);

    // Disattiva eventuali template correnti per questa palestra
    await this.deactivateCurrentForGymRoom(input.gymRoomId);

    // Crea il gruppo di pattern
    const group = this.patternGroupRepo.create({
      gymRoomId: input.gymRoomId,
      name: input.name,
      description: input.description,
      patternDuration,
      patternStartDate: input.patternStartDate,
      validFrom: input.validFrom,
      validUntil: input.validUntil,
      isActive: true,
      isCurrent: true,
      version: 1,
    });

    const savedGroup = await this.patternGroupRepo.save(group);

    // Crea i pattern associati
    await this.createPatterns(savedGroup.id, input.patterns);

    return this.findOne(savedGroup.id);
  }

  /**
   * Aggiorna un template esistente in-place (senza creare nuove versioni)
   */
  async update(id: string, input: UpdateGymPatternGroupInput): Promise<GymPatternGroup> {
    const existingGroup = await this.findOne(id);

    // Aggiorna i metadati
    if (input.name !== undefined) existingGroup.name = input.name;
    if (input.description !== undefined) existingGroup.description = input.description;
    if (input.patternDuration !== undefined) existingGroup.patternDuration = input.patternDuration;
    if (input.patternStartDate !== undefined) existingGroup.patternStartDate = input.patternStartDate;
    if (input.validFrom !== undefined) existingGroup.validFrom = input.validFrom;
    if (input.validUntil !== undefined) existingGroup.validUntil = input.validUntil;
    if (input.isActive !== undefined) existingGroup.isActive = input.isActive;

    await this.patternGroupRepo.save(existingGroup);

    // Se vengono passati i pattern, li aggiorna in-place
    if (input.patterns) {
      await this.updatePatternsInPlace(existingGroup.id, input.patterns, existingGroup.patternDuration);
    }

    return this.findOne(id);
  }

  /**
   * Aggiorna i pattern in-place: elimina i vecchi e crea i nuovi
   */
  private async updatePatternsInPlace(
    groupId: string,
    patterns: CreateGymTemplatePatternInput[],
    patternDuration: number
  ): Promise<void> {
    // Valida i nuovi pattern
    await this.validatePatterns(patterns, patternDuration);

    // Elimina tutti i pattern esistenti per questo gruppo
    await this.patternRepo.delete({ gymPatternGroupId: groupId });

    // Crea i nuovi pattern
    await this.createPatterns(groupId, patterns);
  }

  /**
   * Crea una nuova versione del template
   */
  private async createNewVersion(
    existingGroup: GymPatternGroup,
    input: UpdateGymPatternGroupInput
  ): Promise<GymPatternGroup> {
    const patternDuration = input.patternDuration || existingGroup.patternDuration;

    // Valida i nuovi pattern
    if (input.patterns) {
      await this.validatePatterns(input.patterns, patternDuration);
    }

    // Disattiva la versione corrente
    existingGroup.isCurrent = false;
    existingGroup.validUntil = new Date();
    await this.patternGroupRepo.save(existingGroup);

    // Crea la nuova versione
    const newGroup = this.patternGroupRepo.create({
      gymRoomId: existingGroup.gymRoomId,
      name: input.name || existingGroup.name,
      description: input.description !== undefined ? input.description : existingGroup.description,
      patternDuration,
      patternStartDate: input.patternStartDate || existingGroup.patternStartDate,
      validFrom: input.validFrom || new Date(),
      validUntil: input.validUntil,
      isActive: true,
      isCurrent: true,
      version: existingGroup.version + 1,
    });

    const savedGroup = await this.patternGroupRepo.save(newGroup);

    // Crea i nuovi pattern
    if (input.patterns) {
      await this.createPatterns(savedGroup.id, input.patterns);
    }

    return this.findOne(savedGroup.id);
  }

  /**
   * Elimina un template
   */
  async delete(id: string): Promise<boolean> {
    const group = await this.patternGroupRepo.findOne({ where: { id } });
    if (!group) {
      throw new NotFoundException(`Template palestra con ID ${id} non trovato`);
    }

    if (group.isCurrent) {
      throw new ConflictException(
        'Non è possibile eliminare il template corrente. Disattivalo prima o crea un nuovo template.'
      );
    }

    const result = await this.patternGroupRepo.delete(id);
    return result.affected ? result.affected > 0 : false;
  }

  /**
   * Attiva un template (e disattiva gli altri per la stessa palestra)
   */
  async activate(id: string): Promise<GymPatternGroup> {
    const group = await this.findOne(id);

    // Disattiva altri template correnti
    await this.deactivateCurrentForGymRoom(group.gymRoomId);

    // Attiva questo template
    group.isCurrent = true;
    group.isActive = true;
    await this.patternGroupRepo.save(group);

    return this.findOne(id);
  }

  /**
   * Disattiva un template
   */
  async deactivate(id: string): Promise<GymPatternGroup> {
    const group = await this.findOne(id);
    group.isCurrent = false;
    await this.patternGroupRepo.save(group);
    return this.findOne(id);
  }

  /**
   * Duplica un template esistente
   */
  async duplicate(id: string, newName: string): Promise<GymPatternGroup> {
    const existingGroup = await this.findOne(id);

    // Crea il nuovo gruppo
    const newGroup = this.patternGroupRepo.create({
      gymRoomId: existingGroup.gymRoomId,
      name: newName,
      description: existingGroup.description,
      patternDuration: existingGroup.patternDuration,
      patternStartDate: new Date(),
      validFrom: new Date(),
      isActive: false,
      isCurrent: false,
      version: 1,
    });

    const savedGroup = await this.patternGroupRepo.save(newGroup);

    // Duplica i pattern
    if (existingGroup.patterns && existingGroup.patterns.length > 0) {
      const patterns = existingGroup.patterns.map(p => ({
        operatorId: p.operatorId,
        dayInPattern: p.dayInPattern,
        startTime: p.startTime,
        endTime: p.endTime,
      }));
      await this.createPatterns(savedGroup.id, patterns);
    }

    return this.findOne(savedGroup.id);
  }

  /**
   * Ottiene i pattern per un giorno specifico del ciclo
   */
  async getPatternsForDay(gymRoomId: string, date: Date): Promise<GymTemplatePattern[]> {
    const group = await this.findCurrentByGymRoom(gymRoomId);
    if (!group || !group.patterns) {
      console.log(`[GymPatternGroup] No group or patterns for gymRoomId: ${gymRoomId}`);
      return [];
    }

    // Ensure patternStartDate is a Date object (may come as string from DB)
    const patternStartDate = group.patternStartDate instanceof Date
      ? group.patternStartDate
      : new Date(group.patternStartDate);

    const dayInPattern = this.getPatternDay(date, patternStartDate, group.patternDuration);

    console.log(`[GymPatternGroup] getPatternsForDay:`, {
      gymRoomId,
      date: date.toISOString(),
      patternStartDate: patternStartDate.toISOString(),
      patternDuration: group.patternDuration,
      dayInPattern,
      totalPatterns: group.patterns.length,
      patternDaysInGroup: [...new Set(group.patterns.map(p => p.dayInPattern))],
    });

    const matchingPatterns = group.patterns.filter(p => p.dayInPattern === dayInPattern);
    console.log(`[GymPatternGroup] Matching patterns: ${matchingPatterns.length}`, matchingPatterns.map(p => ({
      dayInPattern: p.dayInPattern,
      startTime: p.startTime,
      endTime: p.endTime,
      operatorId: p.operatorId,
    })));

    return matchingPatterns;
  }

  /**
   * Calcola il giorno nel ciclo del pattern basandosi sul giorno della settimana
   * dayInPattern: 0 = Lunedì, 1 = Martedì, ..., 6 = Domenica
   *
   * NOTA: Ignora patternStartDate e usa direttamente il giorno della settimana
   * per garantire coerenza con l'editor template dove 0=Lunedì
   */
  getPatternDay(date: Date, patternStartDate: Date, patternDuration: number = 7): number {
    const normalizedDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );

    // JavaScript: 0=Dom, 1=Lun, 2=Mar, 3=Mer, 4=Gio, 5=Ven, 6=Sab
    // Pattern: 0=Lun, 1=Mar, 2=Mer, 3=Gio, 4=Ven, 5=Sab, 6=Dom
    const jsDayOfWeek = normalizedDate.getDay(); // 0-6 (Dom-Sab)
    // Converti: Lun=0, Mar=1, Mer=2, Gio=3, Ven=4, Sab=5, Dom=6
    const dayInPattern = jsDayOfWeek === 0 ? 6 : jsDayOfWeek - 1;

    console.log(`[GymPatternGroup] getPatternDay:`, {
      requestedDate: normalizedDate.toISOString().split('T')[0],
      jsDayOfWeek,
      jsDayName: ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'][jsDayOfWeek],
      resultDayInPattern: dayInPattern,
      patternDayName: ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'][dayInPattern],
    });

    return dayInPattern;
  }

  /**
   * Trova l'operatore assegnato per un orario specifico
   */
  async getOperatorForTimeSlot(
    gymRoomId: string,
    date: Date,
    time: string
  ): Promise<Operator | null> {
    const patterns = await this.getPatternsForDay(gymRoomId, date);

    for (const pattern of patterns) {
      if (this.isTimeInRange(time, pattern.startTime, pattern.endTime)) {
        return pattern.operator;
      }
    }

    return null;
  }

  /**
   * Dato un operatore e una data, restituisce tutti gli slot (GymTemplatePattern)
   * in cui quell'operatore era schedulato quel giorno, attraverso TUTTE le
   * palestre che hanno un GymPatternGroup corrente.
   *
   * Usato per derivare le palestre impattate da un'eccezione "operator-wide"
   * e per costruire la lista di slot nel modal di creazione eccezione
   * (sostituzione per slot).
   */
  async getOperatorPatternsOnDate(
    operatorId: string,
    date: Date,
  ): Promise<Array<{ gymRoom: GymRoom; pattern: GymTemplatePattern }>> {
    // Recupera tutti i GymPatternGroup correnti (uno per palestra)
    const currentGroups = await this.patternGroupRepo.find({
      where: { isCurrent: true, isActive: true },
      relations: ['patterns', 'patterns.operator', 'gymRoom'],
    });

    const result: Array<{ gymRoom: GymRoom; pattern: GymTemplatePattern }> = [];

    for (const group of currentGroups) {
      if (!group.patterns || group.patterns.length === 0) continue;

      // Verifica che il gruppo sia valido per la data richiesta (validFrom/validUntil)
      if (group.validFrom && new Date(group.validFrom) > date) continue;
      if (group.validUntil && new Date(group.validUntil) < date) continue;

      const patternStartDate =
        group.patternStartDate instanceof Date
          ? group.patternStartDate
          : new Date(group.patternStartDate);
      const dayInPattern = this.getPatternDay(date, patternStartDate, group.patternDuration);

      for (const pattern of group.patterns) {
        if (pattern.dayInPattern !== dayInPattern) continue;
        if (pattern.operatorId !== operatorId) continue;
        result.push({ gymRoom: group.gymRoom, pattern });
      }
    }

    // Ordina per startTime crescente per dare una presentazione deterministica
    result.sort((a, b) => a.pattern.startTime.localeCompare(b.pattern.startTime));
    return result;
  }

  /**
   * Verifica se un orario è all'interno di un range
   * Normalizza gli orari a HH:MM per evitare problemi di confronto con secondi
   */
  private isTimeInRange(time: string, startTime: string, endTime: string): boolean {
    const normalizedTime = this.normalizeTime(time);
    const normalizedStart = this.normalizeTime(startTime);
    const normalizedEnd = this.normalizeTime(endTime);
    return normalizedTime >= normalizedStart && normalizedTime < normalizedEnd;
  }

  /**
   * Normalizza il formato dell'orario a HH:MM (rimuove i secondi se presenti)
   */
  private normalizeTime(time: string): string {
    if (!time) return time;
    const parts = time.split(':');
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }

  /**
   * Valida i pattern prima della creazione
   */
  private async validatePatterns(
    patterns: CreateGymTemplatePatternInput[],
    patternDuration: number
  ): Promise<void> {
    for (const pattern of patterns) {
      // Valida dayInPattern
      if (pattern.dayInPattern < 0 || pattern.dayInPattern >= patternDuration) {
        throw new BadRequestException(
          `dayInPattern deve essere tra 0 e ${patternDuration - 1}`
        );
      }

      // Valida orari
      if (pattern.startTime >= pattern.endTime) {
        throw new BadRequestException(
          `L'orario di inizio (${pattern.startTime}) deve essere precedente all'orario di fine (${pattern.endTime})`
        );
      }

      // Verifica che l'operatore esista e sia un GYM_INSTRUCTOR
      const operator = await this.operatorRepo.findOne({
        where: { id: pattern.operatorId }
      });

      if (!operator) {
        throw new NotFoundException(`Operatore con ID ${pattern.operatorId} non trovato`);
      }

      if (operator.macroCategory !== OperatorMacroCategory.GYM_INSTRUCTOR) {
        throw new BadRequestException(
          `L'operatore ${operator.name} non è un istruttore palestra (macroCategory: ${operator.macroCategory})`
        );
      }
    }

    // Verifica sovrapposizioni nello stesso giorno
    this.checkPatternOverlaps(patterns);
  }

  /**
   * Verifica che non ci siano sovrapposizioni tra pattern dello stesso giorno
   */
  private checkPatternOverlaps(patterns: CreateGymTemplatePatternInput[]): void {
    const patternsByDay = new Map<number, CreateGymTemplatePatternInput[]>();

    // Raggruppa per giorno
    for (const pattern of patterns) {
      const dayPatterns = patternsByDay.get(pattern.dayInPattern) || [];
      dayPatterns.push(pattern);
      patternsByDay.set(pattern.dayInPattern, dayPatterns);
    }

    // Verifica sovrapposizioni per ogni giorno
    for (const [day, dayPatterns] of patternsByDay) {
      for (let i = 0; i < dayPatterns.length; i++) {
        for (let j = i + 1; j < dayPatterns.length; j++) {
          if (this.timesOverlap(
            dayPatterns[i].startTime,
            dayPatterns[i].endTime,
            dayPatterns[j].startTime,
            dayPatterns[j].endTime
          )) {
            throw new BadRequestException(
              `Sovrapposizione di orari nel giorno ${day}: ` +
              `${dayPatterns[i].startTime}-${dayPatterns[i].endTime} e ` +
              `${dayPatterns[j].startTime}-${dayPatterns[j].endTime}`
            );
          }
        }
      }
    }
  }

  /**
   * Verifica se due intervalli di tempo si sovrappongono
   */
  private timesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
    return start1 < end2 && start2 < end1;
  }

  /**
   * Disattiva tutti i template correnti per una palestra
   */
  private async deactivateCurrentForGymRoom(gymRoomId: string): Promise<void> {
    await this.patternGroupRepo.update(
      { gymRoomId, isCurrent: true },
      { isCurrent: false }
    );
  }

  /**
   * Crea i pattern per un gruppo
   */
  private async createPatterns(
    gymPatternGroupId: string,
    patterns: CreateGymTemplatePatternInput[]
  ): Promise<void> {
    const patternEntities = patterns.map(p =>
      this.patternRepo.create({
        gymPatternGroupId,
        operatorId: p.operatorId,
        dayInPattern: p.dayInPattern,
        startTime: p.startTime,
        endTime: p.endTime,
      })
    );

    await this.patternRepo.save(patternEntities);
  }
}
