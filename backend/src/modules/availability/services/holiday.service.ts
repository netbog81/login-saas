import { Injectable } from '@nestjs/common';
import { Between } from 'typeorm';
import { AvailabilityException, ExceptionType } from '../entities/availability-exception.entity';
import { Operator } from '../entities/operator.entity';
import { TenantContextService } from '@curandis/tenant-datasource';

export interface Holiday {
  date: Date;
  name: string;
}

@Injectable()
export class HolidayService {
  constructor(
    private readonly tenantContext: TenantContextService,
  ){}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get exceptionRepo() { return this.dataSource.getRepository(AvailabilityException); }

  private get operatorRepo() { return this.dataSource.getRepository(Operator); }

  /**
   * Calculate Easter Sunday using the Anonymous Gregorian algorithm
   */
  private calculateEaster(year: number): Date {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;

    return new Date(year, month - 1, day);
  }

  /**
   * Get all Italian holidays for a given year
   */
  getHolidaysForYear(year: number): Holiday[] {
    const easter = this.calculateEaster(year);

    // Easter Monday (Pasquetta) - day after Easter
    const easterMonday = new Date(easter);
    easterMonday.setDate(easter.getDate() + 1);

    const holidays: Holiday[] = [
      // Fixed holidays
      { date: new Date(year, 0, 1), name: 'Capodanno' },
      { date: new Date(year, 0, 6), name: 'Epifania' },
      { date: new Date(year, 3, 25), name: 'Festa della Liberazione' },
      { date: new Date(year, 4, 1), name: 'Festa dei Lavoratori' },
      { date: new Date(year, 5, 2), name: 'Festa della Repubblica' },
      { date: new Date(year, 7, 15), name: 'Ferragosto' },
      { date: new Date(year, 10, 1), name: 'Tutti i Santi' },
      { date: new Date(year, 11, 8), name: 'Immacolata Concezione' },
      { date: new Date(year, 11, 25), name: 'Natale' },
      { date: new Date(year, 11, 26), name: 'Santo Stefano' },
      // Mobile holidays
      { date: easter, name: 'Pasqua' },
      { date: easterMonday, name: 'Lunedì dell\'Angelo' },
    ];

    return holidays.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Check if a date is a holiday
   */
  isHoliday(date: Date): Holiday | null {
    const year = date.getFullYear();
    const holidays = this.getHolidaysForYear(year);

    const dateStr = date.toISOString().split('T')[0];
    return holidays.find(h => h.date.toISOString().split('T')[0] === dateStr) || null;
  }

  /**
   * Generate holiday exceptions for all operators for a given year
   */
  async generateHolidaysForYear(year: number): Promise<number> {
    const holidays = this.getHolidaysForYear(year);
    const operators = await this.operatorRepo.find({ where: { isActive: true } });

    let created = 0;

    for (const operator of operators) {
      for (const holiday of holidays) {
        // Check if exception already exists
        const existing = await this.exceptionRepo.findOne({
          where: {
            operatorId: operator.id,
            exceptionDate: holiday.date,
            exceptionType: ExceptionType.HOLIDAY,
          },
        });

        if (!existing) {
          const exception = this.exceptionRepo.create({
            operatorId: operator.id,
            exceptionDate: holiday.date,
            exceptionType: ExceptionType.HOLIDAY,
            reason: holiday.name,
          });
          await this.exceptionRepo.save(exception);
          created++;
        }
      }
    }

    return created;
  }

  /**
   * Generate holiday exceptions for a specific operator for a given year
   */
  async generateHolidaysForOperator(operatorId: string, year: number): Promise<number> {
    const holidays = this.getHolidaysForYear(year);

    let created = 0;

    for (const holiday of holidays) {
      const existing = await this.exceptionRepo.findOne({
        where: {
          operatorId,
          exceptionDate: holiday.date,
          exceptionType: ExceptionType.HOLIDAY,
        },
      });

      if (!existing) {
        const exception = this.exceptionRepo.create({
          operatorId,
          exceptionDate: holiday.date,
          exceptionType: ExceptionType.HOLIDAY,
          reason: holiday.name,
        });
        await this.exceptionRepo.save(exception);
        created++;
      }
    }

    return created;
  }

  /**
   * Get holidays for a date range
   */
  getHolidaysInRange(startDate: Date, endDate: Date): Holiday[] {
    const holidays: Holiday[] = [];
    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();

    for (let year = startYear; year <= endYear; year++) {
      const yearHolidays = this.getHolidaysForYear(year);
      holidays.push(
        ...yearHolidays.filter(
          h => h.date >= startDate && h.date <= endDate
        )
      );
    }

    return holidays;
  }

  /**
   * Delete all holiday exceptions for a given year
   */
  async deleteHolidaysForYear(year: number): Promise<number> {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);

    const result = await this.exceptionRepo.delete({
      exceptionType: ExceptionType.HOLIDAY,
      exceptionDate: Between(startDate, endDate),
    });

    return result.affected || 0;
  }
}
