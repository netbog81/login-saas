import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, IsNull, Not, DataSource } from 'typeorm';
import { Operator } from '../entities/operator.entity';
import { OperatorMacroCategory } from '../entities/operator-macro-category.enum';
import { CreateOperatorInput } from '../dto/create-operator.input';
import { UpdateOperatorInput } from '../dto/update-operator.input';
import { AppUser } from '../../users/entities/app-user.entity';
import { AppUserType } from '../../users/enums/app-user-type.enum';
import { Treatment } from '../entities/treatment.entity';
import { TherapeuticPath } from '../entities/therapeutic-path.entity';
import { PatientEvaluation } from '../entities/patient-evaluation.entity';
import { PatientAnamnesis } from '../entities/patient-anamnesis.entity';
import { AvailabilityAppointment } from '../entities/availability-appointment.entity';
import { GymSchedule } from '../entities/gym-schedule.entity';
import { TemplateAssignment } from '../entities/template-assignment.entity';
import { WaitingListEntry } from '../entities/waiting-list-entry.entity';
import { AvailabilityTemplate } from '../entities/availability-template.entity';

/**
 * Esito dell'eliminazione di un operatore: il chiamante può sapere se è
 * stato archiviato (soft) o eliminato definitivamente (hard).
 */
export interface DeleteOperatorResult {
  archived: boolean;
  hardDeleted: boolean;
  /** Conteggio dipendenze che hanno determinato l'archiviazione (0 se hard). */
  dependencies: OperatorDependencyCount;
}

export interface OperatorDependencyCount {
  total: number;
  treatments: number;
  therapeuticPaths: number;
  evaluations: number;
  anamnesis: number;
  appointments: number;
  gymSchedules: number;
  templateAssignments: number;
  waitingList: number;
}

@Injectable()
export class OperatorService {
  private readonly logger = new Logger(OperatorService.name);

  constructor(
    @InjectRepository(Operator)
    private readonly operatorRepo: Repository<Operator>,
    @InjectRepository(AppUser)
    private readonly appUserRepo: Repository<AppUser>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Trova operatori con nome simile (case-insensitive)
   * Usato per check duplicati prima della creazione
   */
  async findSimilarOperators(name: string, surname?: string): Promise<Operator[]> {
    const whereConditions: any[] = [];

    if (surname) {
      // Se c'è cognome, cerca nome E cognome (case-insensitive)
      whereConditions.push({
        name: ILike(`%${name}%`),
        surname: ILike(`%${surname}%`),
      });
    } else {
      // Se non c'è cognome, cerca solo per nome
      whereConditions.push({
        name: ILike(`%${name}%`),
      });
    }

    return this.operatorRepo.find({
      where: whereConditions,
      relations: ['category'],
      order: { name: 'ASC' },
    });
  }

  /**
   * Trova operatore per User ID (per sistema auth)
   */
  async findByUserId(userId: string): Promise<Operator | null> {
    return this.operatorRepo.findOne({
      where: { userId },
      relations: ['category'],
    });
  }

  /**
   * Trova operatore per AppUser ID (mapping Keycloak → Operator)
   */
  async findByAppUserId(appUserId: string): Promise<Operator | null> {
    return this.operatorRepo.findOne({
      where: { appUserId },
      relations: ['category', 'templateAssignments'],
    });
  }

  /**
   * Trova tutti gli operatori con filtri opzionali
   */
  async findAll(filters?: {
    macroCategory?: string;
    categoryId?: string;
    onlyActive?: boolean;
  }): Promise<Operator[]> {
    const where: any = {};

    if (filters?.macroCategory) {
      where.macroCategory = filters.macroCategory;
    }

    if (filters?.categoryId) {
      where.categoryId = filters.categoryId;
    }

    // Solo se onlyActive è true, applicare il filtro per mostrare solo attivi
    if (filters?.onlyActive === true) {
      where.isActive = true;
    }

    return this.operatorRepo.find({
      where,
      relations: ['category', 'templateAssignments'],
      order: { name: 'ASC' },
    });
  }

  /**
   * Trova operatore per ID
   */
  async findOne(id: string): Promise<Operator> {
    const operator = await this.operatorRepo.findOne({
      where: { id },
      relations: ['category'],
    });

    if (!operator) {
      throw new NotFoundException(`Operatore con ID ${id} non trovato`);
    }

    return operator;
  }

  /**
   * Crea un nuovo operatore con validazione business logic
   */
  async create(input: CreateOperatorInput): Promise<Operator> {
    // Validazione nome obbligatorio
    if (!input.name || input.name.trim() === '') {
      throw new BadRequestException('Il nome è obbligatorio');
    }

    // Validazione email univoca se fornita
    if (input.email) {
      const existingByEmail = await this.operatorRepo.findOne({
        where: { email: input.email },
      });

      if (existingByEmail) {
        throw new ConflictException(
          `Esiste già un operatore con email ${input.email}`,
        );
      }
    }

    // Validazione userId se fornito (deve esistere in tabella users)
    if (input.userId) {
      const existingByUserId = await this.operatorRepo.findOne({
        where: { userId: input.userId },
      });

      if (existingByUserId) {
        throw new ConflictException(
          `L'account utente ${input.userId} è già associato all'operatore ${existingByUserId.name}`,
        );
      }
    }

    // Crea app_user associato
    const appUser = this.appUserRepo.create({
      name: input.name,
      surname: input.surname,
      email: input.email,
      phone: input.phone,
      userType: AppUserType.OPERATOR,
      isActive: input.isActive ?? true,
      attributes: {},
    });
    const savedAppUser = await this.appUserRepo.save(appUser);

    // Default canCollectPayment in base alla categoria:
    // gli istruttori palestra nascono senza permesso di incasso,
    // tutti gli altri con permesso. Admin può modificare dopo dalla UI.
    const defaultCanCollectPayment =
      input.canCollectPayment ??
      input.macroCategory !== OperatorMacroCategory.GYM_INSTRUCTOR;

    // Crea operatore con riferimento ad app_user
    const operator = this.operatorRepo.create({
      ...input,
      appUserId: savedAppUser.id,
      isActive: input.isActive ?? true,
      maxConcurrentAppointments: input.maxConcurrentAppointments || 1,
      canCollectPayment: defaultCanCollectPayment,
    });

    try {
      return await this.operatorRepo.save(operator);
    } catch (error) {
      // Gestisci errore di violazione unique constraint
      if (error.code === '23505') {
        // PostgreSQL error code per unique violation
        if (error.detail?.includes('email')) {
          throw new ConflictException(
            `Esiste già un operatore con email ${input.email}`,
          );
        }
        throw new ConflictException('Violazione vincolo di unicità');
      }
      throw error;
    }
  }

  /**
   * Aggiorna un operatore esistente
   */
  async update(id: string, input: UpdateOperatorInput): Promise<Operator> {
    const operator = await this.findOne(id);

    // Validazione email univoca se modificata
    if (input.email && input.email !== operator.email) {
      const existingByEmail = await this.operatorRepo.findOne({
        where: { email: input.email },
      });

      if (existingByEmail && existingByEmail.id !== id) {
        throw new ConflictException(
          `Esiste già un operatore con email ${input.email}`,
        );
      }
    }

    // Validazione userId se modificato
    if (input.userId && input.userId !== operator.userId) {
      const existingByUserId = await this.operatorRepo.findOne({
        where: { userId: input.userId },
      });

      if (existingByUserId && existingByUserId.id !== id) {
        throw new ConflictException(
          `L'account utente ${input.userId} è già associato all'operatore ${existingByUserId.name}`,
        );
      }
    }

    // Aggiorna campi
    Object.assign(operator, input);

    // Sincronizza campi identita' con app_users
    if (operator.appUserId) {
      const identityUpdate: Partial<AppUser> = {};
      if (input.name !== undefined) identityUpdate.name = input.name;
      if (input.surname !== undefined) identityUpdate.surname = input.surname;
      if (input.email !== undefined) identityUpdate.email = input.email;
      if (input.phone !== undefined) identityUpdate.phone = input.phone;
      if (input.isActive !== undefined) identityUpdate.isActive = input.isActive;

      if (Object.keys(identityUpdate).length > 0) {
        await this.appUserRepo.update(operator.appUserId, identityUpdate);
      }
    }

    return this.operatorRepo.save(operator);
  }

  /**
   * Elimina un operatore.
   *
   * Se l'operatore ha QUALSIASI dipendenza storica (trattamenti, percorsi,
   * valutazioni, anamnesi, appuntamenti, gym schedule, template assignment,
   * waiting list) → applica **archiviazione** (soft-delete preservando lo
   * storico clinico/contabile). Solo gli operatori senza alcuna dipendenza
   * vengono eliminati definitivamente con hard-delete.
   *
   * @param id - id operatore
   * @param deletedByUserId - AppUser admin che esegue l'azione (audit)
   */
  async delete(id: string, deletedByUserId?: string): Promise<DeleteOperatorResult> {
    const operator = await this.operatorRepo.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!operator) {
      throw new NotFoundException(`Operatore ${id} non trovato`);
    }
    if (operator.deletedAt) {
      throw new ConflictException(
        `Operatore ${id} è già archiviato. Per renderlo selezionabile usa restoreOperator.`,
      );
    }

    const dependencies = await this.countDependencies(id);

    if (dependencies.total > 0) {
      await this.archiveInternal(id, deletedByUserId);
      return { archived: true, hardDeleted: false, dependencies };
    }

    // Hard delete: nessuna dipendenza → comportamento storico preservato
    if (operator.appUserId) {
      await this.appUserRepo.delete(operator.appUserId);
    }
    await this.operatorRepo.remove(operator);
    return { archived: false, hardDeleted: true, dependencies };
  }

  /**
   * Esegue solo l'archiviazione (senza la branch hard-delete). Usato dal
   * resolver quando l'admin sceglie esplicitamente "archivia" anche su
   * operatore senza dipendenze (per scelta UI), o internamente da `delete()`
   * quando ha dipendenze. Idempotente: solleva ConflictException se già
   * archiviato.
   */
  async archive(id: string, deletedByUserId?: string): Promise<Operator> {
    const operator = await this.operatorRepo.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!operator) throw new NotFoundException(`Operatore ${id} non trovato`);
    if (operator.deletedAt) {
      throw new ConflictException(`Operatore ${id} è già archiviato.`);
    }
    await this.archiveInternal(id, deletedByUserId);
    return this.findOneIncludingArchived(id);
  }

  /**
   * Implementazione transazionale dell'archiviazione:
   *  1. soft-delete operator (deletedAt set) + isActive=false + deletedByUserId
   *  2. AppUser.isActive=false (impedisce login)
   *  3. availability_templates.isActive=false (no slot in nuove generazioni)
   */
  private async archiveInternal(id: string, deletedByUserId?: string): Promise<void> {
    await this.dataSource.transaction(async manager => {
      const opRepo = manager.getRepository(Operator);
      const op = await opRepo.findOneOrFail({ where: { id } });

      // 1. audit + isActive false (save preserva il record), poi softDelete
      op.isActive = false;
      op.deletedByUserId = deletedByUserId ?? undefined;
      await opRepo.save(op);
      await opRepo.softDelete(id);

      // 2. AppUser collegato disattivato
      if (op.appUserId) {
        await manager.getRepository(AppUser).update(op.appUserId, {
          isActive: false,
        });
      }

      // 3. Template di disponibilità "scollegati dall'attualità": la
      //    generazione slot non li userà più (isCurrent=false). Al
      //    ripristino l'admin riattiva il template che vuole rendere
      //    nuovamente corrente. Manteniamo i template come storico.
      await manager
        .getRepository(AvailabilityTemplate)
        .update({ operatorId: id, isCurrent: true }, { isCurrent: false });
    });

    this.logger.log(
      `Operatore ${id} archiviato (deletedByUserId=${deletedByUserId ?? 'null'})`,
    );
  }

  /**
   * Ripristina un operatore archiviato. NB: i template di disponibilità
   * NON vengono riattivati automaticamente — l'admin li riattiva
   * manualmente dopo aver verificato che siano ancora coerenti.
   */
  async restore(id: string): Promise<Operator> {
    const operator = await this.operatorRepo.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!operator) throw new NotFoundException(`Operatore ${id} non trovato`);
    if (!operator.deletedAt) {
      throw new ConflictException(`Operatore ${id} non è archiviato.`);
    }

    await this.dataSource.transaction(async manager => {
      const opRepo = manager.getRepository(Operator);
      await opRepo.restore(id);
      // Pulisco audit di archiviazione e riattivo
      await opRepo.update(id, {
        isActive: true,
        deletedByUserId: undefined,
      } as any);
      if (operator.appUserId) {
        await manager.getRepository(AppUser).update(operator.appUserId, {
          isActive: true,
        });
      }
    });

    this.logger.log(`Operatore ${id} ripristinato`);
    return this.findOne(id) as Promise<Operator>;
  }

  /**
   * Lista degli operatori archiviati (deletedAt non null). Per la pagina
   * admin "Operatori archiviati" con bottone Ripristina.
   */
  async findArchived(): Promise<Operator[]> {
    return this.operatorRepo.find({
      where: { deletedAt: Not(IsNull()) } as any,
      withDeleted: true,
      relations: ['category', 'appUser'],
      order: { deletedAt: 'DESC' },
    });
  }

  /**
   * Conta le dipendenze "storiche" di un operatore. Una qualunque
   * dipendenza > 0 implica che il record non può essere hard-deletato
   * senza perdere informazioni clinico/contabili.
   *
   * Per le entità con soft-delete (Treatment, TherapeuticPath,
   * PatientEvaluation, AvailabilityAppointment) si conta anche i record
   * soft-deletati: contano comunque come "storico associato".
   */
  async countDependencies(operatorId: string): Promise<OperatorDependencyCount> {
    const [
      treatments,
      therapeuticPaths,
      evaluations,
      anamnesis,
      appointments,
      gymSchedules,
      templateAssignments,
      waitingList,
    ] = await Promise.all([
      this.dataSource.getRepository(Treatment).count({
        where: { operatorId },
        withDeleted: true,
      }),
      this.dataSource.getRepository(TherapeuticPath).count({
        where: { primaryOperatorId: operatorId },
        withDeleted: true,
      }),
      this.dataSource.getRepository(PatientEvaluation).count({
        where: { operatorId },
        withDeleted: true,
      }),
      this.dataSource.getRepository(PatientAnamnesis).count({
        where: { operatorId },
      }),
      this.dataSource.getRepository(AvailabilityAppointment).count({
        where: { operatorId },
        withDeleted: true,
      }),
      this.dataSource.getRepository(GymSchedule).count({
        where: { operatorId },
      }),
      this.dataSource.getRepository(TemplateAssignment).count({
        where: { operatorId },
      }),
      this.dataSource.getRepository(WaitingListEntry).count({
        where: { operatorId },
      }),
    ]);

    return {
      total:
        treatments +
        therapeuticPaths +
        evaluations +
        anamnesis +
        appointments +
        gymSchedules +
        templateAssignments +
        waitingList,
      treatments,
      therapeuticPaths,
      evaluations,
      anamnesis,
      appointments,
      gymSchedules,
      templateAssignments,
      waitingList,
    };
  }

  /**
   * findOne includendo gli archiviati. Usato dopo restore per ritornare
   * il record con tutte le relazioni.
   */
  private async findOneIncludingArchived(id: string): Promise<Operator> {
    const op = await this.operatorRepo.findOne({
      where: { id },
      withDeleted: true,
      relations: ['category', 'appUser'],
    });
    if (!op) throw new NotFoundException(`Operatore ${id} non trovato`);
    return op;
  }
}
