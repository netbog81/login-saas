import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Operator } from '../entities/operator.entity';
import { CreateOperatorInput } from '../dto/create-operator.input';
import { UpdateOperatorInput } from '../dto/update-operator.input';
import { AppUser } from '../../users/entities/app-user.entity';
import { AppUserType } from '../../users/enums/app-user-type.enum';

@Injectable()
export class OperatorService {
  private readonly logger = new Logger(OperatorService.name);

  constructor(
    @InjectRepository(Operator)
    private readonly operatorRepo: Repository<Operator>,
    @InjectRepository(AppUser)
    private readonly appUserRepo: Repository<AppUser>,
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

    // Crea operatore con riferimento ad app_user
    const operator = this.operatorRepo.create({
      ...input,
      appUserId: savedAppUser.id,
      isActive: input.isActive ?? true,
      maxConcurrentAppointments: input.maxConcurrentAppointments || 1,
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
   * Elimina un operatore
   */
  async delete(id: string): Promise<boolean> {
    const operator = await this.findOne(id);

    // Validazione: verifica se ha appuntamenti o template attivi
    // TODO: Aggiungere check su relazioni critiche se necessario
    // Per ora permettiamo eliminazione diretta

    await this.operatorRepo.remove(operator);
    return true;
  }
}
