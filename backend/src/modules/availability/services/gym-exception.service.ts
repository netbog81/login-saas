import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { GymException, GymExceptionType } from '../entities/gym-exception.entity';
import { GymRoom } from '../entities/gym-room.entity';
import { Operator } from '../entities/operator.entity';
import { OperatorMacroCategory } from '../entities/operator-macro-category.enum';

export interface CreateGymExceptionInput {
  gymRoomId: string;
  operatorId?: string;
  exceptionDate: Date;
  startTime?: string;
  endTime?: string;
  exceptionType: GymExceptionType;
  substituteOperatorId?: string;
  reason?: string;
  createdBy?: string;
}

export interface UpdateGymExceptionInput {
  operatorId?: string;
  exceptionDate?: Date;
  startTime?: string;
  endTime?: string;
  exceptionType?: GymExceptionType;
  substituteOperatorId?: string;
  reason?: string;
}

@Injectable()
export class GymExceptionService {
  constructor(
    @InjectRepository(GymException)
    private exceptionRepo: Repository<GymException>,
    @InjectRepository(GymRoom)
    private gymRoomRepo: Repository<GymRoom>,
    @InjectRepository(Operator)
    private operatorRepo: Repository<Operator>,
  ) {}

  /**
   * Trova tutte le eccezioni per una palestra in un range di date
   */
  async findByDateRange(
    gymRoomId: string,
    startDate: Date,
    endDate: Date
  ): Promise<GymException[]> {
    return this.exceptionRepo.find({
      where: {
        gymRoomId,
        exceptionDate: Between(startDate, endDate),
      },
      relations: ['gymRoom', 'operator', 'substituteOperator'],
      order: { exceptionDate: 'ASC', startTime: 'ASC' },
    });
  }

  /**
   * Trova le eccezioni per una data specifica
   */
  async findByDate(gymRoomId: string, date: Date): Promise<GymException[]> {
    return this.exceptionRepo.find({
      where: { gymRoomId, exceptionDate: date },
      relations: ['gymRoom', 'operator', 'substituteOperator'],
      order: { startTime: 'ASC' },
    });
  }

  /**
   * Trova un'eccezione per ID
   */
  async findOne(id: string): Promise<GymException> {
    const exception = await this.exceptionRepo.findOne({
      where: { id },
      relations: ['gymRoom', 'operator', 'substituteOperator'],
    });

    if (!exception) {
      throw new NotFoundException(`Eccezione palestra con ID ${id} non trovata`);
    }

    return exception;
  }

  /**
   * Crea una nuova eccezione
   */
  async create(input: CreateGymExceptionInput): Promise<GymException> {
    // Verifica che la palestra esista
    const gymRoom = await this.gymRoomRepo.findOne({ where: { id: input.gymRoomId } });
    if (!gymRoom) {
      throw new NotFoundException(`Palestra con ID ${input.gymRoomId} non trovata`);
    }

    // Valida gli orari se forniti
    if (input.startTime && input.endTime) {
      if (input.startTime >= input.endTime) {
        throw new BadRequestException(
          `L'orario di inizio (${input.startTime}) deve essere precedente all'orario di fine (${input.endTime})`
        );
      }
    }

    // Se c'è un operatorId, verifica che esista e sia un GYM_INSTRUCTOR
    if (input.operatorId) {
      await this.validateGymOperator(input.operatorId);
    }

    // Se c'è un substituteOperatorId, verifica che esista e sia un GYM_INSTRUCTOR
    if (input.substituteOperatorId) {
      await this.validateGymOperator(input.substituteOperatorId);
    }

    // Crea l'eccezione
    const exception = this.exceptionRepo.create({
      gymRoomId: input.gymRoomId,
      operatorId: input.operatorId,
      exceptionDate: input.exceptionDate,
      startTime: input.startTime,
      endTime: input.endTime,
      exceptionType: input.exceptionType,
      substituteOperatorId: input.substituteOperatorId,
      reason: input.reason,
      createdBy: input.createdBy,
    });

    const savedException = await this.exceptionRepo.save(exception);
    return this.findOne(savedException.id);
  }

  /**
   * Aggiorna un'eccezione esistente
   */
  async update(id: string, input: UpdateGymExceptionInput): Promise<GymException> {
    const exception = await this.findOne(id);

    // Valida gli orari se forniti
    const startTime = input.startTime !== undefined ? input.startTime : exception.startTime;
    const endTime = input.endTime !== undefined ? input.endTime : exception.endTime;

    if (startTime && endTime && startTime >= endTime) {
      throw new BadRequestException(
        `L'orario di inizio (${startTime}) deve essere precedente all'orario di fine (${endTime})`
      );
    }

    // Valida operatori se forniti
    if (input.operatorId) {
      await this.validateGymOperator(input.operatorId);
    }

    if (input.substituteOperatorId) {
      await this.validateGymOperator(input.substituteOperatorId);
    }

    // Aggiorna i campi
    if (input.operatorId !== undefined) exception.operatorId = input.operatorId;
    if (input.exceptionDate !== undefined) exception.exceptionDate = input.exceptionDate;
    if (input.startTime !== undefined) exception.startTime = input.startTime;
    if (input.endTime !== undefined) exception.endTime = input.endTime;
    if (input.exceptionType !== undefined) exception.exceptionType = input.exceptionType;
    if (input.substituteOperatorId !== undefined) exception.substituteOperatorId = input.substituteOperatorId;
    if (input.reason !== undefined) exception.reason = input.reason;

    await this.exceptionRepo.save(exception);
    return this.findOne(id);
  }

  /**
   * Elimina un'eccezione
   */
  async delete(id: string): Promise<boolean> {
    const exception = await this.exceptionRepo.findOne({ where: { id } });
    if (!exception) {
      throw new NotFoundException(`Eccezione palestra con ID ${id} non trovata`);
    }

    const result = await this.exceptionRepo.delete(id);
    return result.affected ? result.affected > 0 : false;
  }

  /**
   * Verifica se c'è un'eccezione per una palestra in una data e orario specifico
   */
  async hasException(
    gymRoomId: string,
    date: Date,
    time?: string
  ): Promise<GymException | null> {
    const exceptions = await this.findByDate(gymRoomId, date);

    for (const exception of exceptions) {
      // Eccezione per tutto il giorno
      if (!exception.startTime || !exception.endTime) {
        return exception;
      }

      // Eccezione per fascia oraria specifica
      if (time && exception.startTime && exception.endTime) {
        if (time >= exception.startTime && time < exception.endTime) {
          return exception;
        }
      }
    }

    return null;
  }

  /**
   * Verifica se un operatore è disponibile (non ha eccezioni) in una data/orario
   */
  async isOperatorAvailable(
    gymRoomId: string,
    operatorId: string,
    date: Date,
    time?: string
  ): Promise<{ available: boolean; exception?: GymException; substituteOperator?: Operator }> {
    const exceptions = await this.findByDate(gymRoomId, date);

    for (const exception of exceptions) {
      // Verifica se l'eccezione è per questo operatore o per tutta la palestra
      if (exception.operatorId && exception.operatorId !== operatorId) {
        continue;
      }

      // Eccezione per tutto il giorno
      if (!exception.startTime || !exception.endTime) {
        return {
          available: false,
          exception,
          substituteOperator: exception.substituteOperator,
        };
      }

      // Eccezione per fascia oraria specifica
      if (time && exception.startTime && exception.endTime) {
        if (time >= exception.startTime && time < exception.endTime) {
          return {
            available: false,
            exception,
            substituteOperator: exception.substituteOperator,
          };
        }
      }
    }

    return { available: true };
  }

  /**
   * Ottiene l'operatore effettivo per uno slot (considerando le sostituzioni)
   */
  async getEffectiveOperator(
    gymRoomId: string,
    templateOperatorId: string,
    date: Date,
    time: string
  ): Promise<{ operator: Operator; isSubstitute: boolean; originalOperatorId?: string }> {
    const availability = await this.isOperatorAvailable(gymRoomId, templateOperatorId, date, time);

    if (!availability.available && availability.substituteOperator) {
      return {
        operator: availability.substituteOperator,
        isSubstitute: true,
        originalOperatorId: templateOperatorId,
      };
    }

    // Se non disponibile e non c'è sostituto, restituiamo comunque l'operatore originale
    // (sarà il frontend a gestire il messaggio di indisponibilità)
    const operator = await this.operatorRepo.findOne({ where: { id: templateOperatorId } });
    if (!operator) {
      throw new NotFoundException(`Operatore con ID ${templateOperatorId} non trovato`);
    }

    return {
      operator,
      isSubstitute: false,
    };
  }

  /**
   * Valida che un operatore sia un GYM_INSTRUCTOR
   */
  private async validateGymOperator(operatorId: string): Promise<Operator> {
    const operator = await this.operatorRepo.findOne({ where: { id: operatorId } });

    if (!operator) {
      throw new NotFoundException(`Operatore con ID ${operatorId} non trovato`);
    }

    if (operator.macroCategory !== OperatorMacroCategory.GYM_INSTRUCTOR) {
      throw new BadRequestException(
        `L'operatore ${operator.name} non è un istruttore palestra (macroCategory: ${operator.macroCategory})`
      );
    }

    return operator;
  }
}
