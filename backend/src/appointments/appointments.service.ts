import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Appointment } from '../entities/appointment.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private appointmentsRepository: Repository<Appointment>,
  ) {}

  async findByDateRange(startDate: string, endDate: string, operatorId?: string): Promise<Appointment[]> {
    const where: any = {
      date: Between(startDate, endDate)
    };

    if (operatorId) {
      where.operatorId = operatorId;
    }

    return this.appointmentsRepository.find({
      where,
      relations: ['operator', 'patient'],
      order: { date: 'ASC', startTime: 'ASC' }
    });
  }

  async findByDate(date: string, operatorId?: string): Promise<Appointment[]> {
    const where: any = { date };

    if (operatorId) {
      where.operatorId = operatorId;
    }

    return this.appointmentsRepository.find({
      where,
      relations: ['operator', 'patient'],
      order: { startTime: 'ASC' }
    });
  }

  findOne(id: string): Promise<Appointment> {
    return this.appointmentsRepository.findOne({
      where: { id },
      relations: ['operator', 'patient']
    });
  }

  async create(appointmentData: Partial<Appointment>): Promise<Appointment[]> {
    const appointments: Appointment[] = [];

    // Se la ripetizione è abilitata, crea gli appuntamenti ricorrenti
    if (appointmentData.repeat?.enabled) {
      const recurringGroupId = uuidv4();
      const recurringAppointments = this.generateRecurringAppointments(
        appointmentData,
        recurringGroupId
      );

      for (const aptData of recurringAppointments) {
        const appointment = this.appointmentsRepository.create(aptData);
        const saved = await this.appointmentsRepository.save(appointment);
        appointments.push(saved);
      }
    } else {
      // Crea singolo appuntamento
      const appointment = this.appointmentsRepository.create(appointmentData);
      const saved = await this.appointmentsRepository.save(appointment);
      appointments.push(saved);
    }

    return appointments;
  }

  async update(id: string, appointmentData: Partial<Appointment>): Promise<Appointment> {
    await this.appointmentsRepository.update(id, appointmentData);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.appointmentsRepository.delete(id);
  }

  async removeRecurringGroup(recurringGroupId: string): Promise<void> {
    await this.appointmentsRepository.delete({ recurringGroupId });
  }

  private generateRecurringAppointments(
    baseData: Partial<Appointment>,
    recurringGroupId: string
  ): Partial<Appointment>[] {
    const appointments: Partial<Appointment>[] = [];
    const { repeat, date, ...appointmentBase } = baseData;

    if (!repeat || !date) return [baseData];

    const baseDate = new Date(date);
    let currentDate = new Date(baseDate);
    let count = 0;
    const maxIterations = 365; // Limite di sicurezza

    // Aggiungi l'appuntamento base
    appointments.push({
      ...appointmentBase,
      date,
      repeat,
      recurringGroupId
    });

    while (count < maxIterations) {
      // Calcola la prossima data in base al tipo di ripetizione
      if (repeat.type === 'daily') {
        currentDate.setDate(currentDate.getDate() + repeat.interval);
      } else if (repeat.type === 'weekly') {
        if (repeat.selectedDays && repeat.selectedDays.length > 0) {
          // Trova il prossimo giorno selezionato
          let daysToAdd = 1;
          while (daysToAdd < 7) {
            const nextDate = new Date(currentDate);
            nextDate.setDate(currentDate.getDate() + daysToAdd);
            const dayOfWeek = nextDate.getDay();
            if (repeat.selectedDays.includes(dayOfWeek)) {
              currentDate = nextDate;
              break;
            }
            daysToAdd++;
          }
          if (daysToAdd >= 7) {
            // Se non troviamo un giorno nella settimana corrente, passa alla prossima
            currentDate.setDate(currentDate.getDate() + (7 * repeat.interval));
          }
        } else {
          currentDate.setDate(currentDate.getDate() + (7 * repeat.interval));
        }
      } else if (repeat.type === 'monthly') {
        currentDate.setMonth(currentDate.getMonth() + repeat.interval);
      }

      // Verifica condizioni di fine
      if (repeat.endType === 'after' && appointments.length >= repeat.occurrences) {
        break;
      }
      if (repeat.endType === 'until' && currentDate > new Date(repeat.untilDate)) {
        break;
      }
      if (repeat.endType === 'never' && count >= 52) {
        // Limite per "never": massimo 1 anno di appuntamenti
        break;
      }

      const dateStr = currentDate.toISOString().split('T')[0];

      // Non duplicare l'appuntamento base
      if (dateStr !== date) {
        appointments.push({
          ...appointmentBase,
          date: dateStr,
          repeat,
          recurringGroupId
        });
      }

      count++;
    }

    return appointments;
  }

  async checkAvailability(
    operatorId: string,
    date: string,
    startTime: string,
    endTime: string,
    excludeAppointmentId?: string
  ): Promise<boolean> {
    const where: any = {
      operatorId,
      date
    };

    if (excludeAppointmentId) {
      // Escludi l'appuntamento corrente (utile per modifiche)
      where.id = { $ne: excludeAppointmentId };
    }

    const existingAppointments = await this.appointmentsRepository.find({
      where,
      order: { startTime: 'ASC' }
    });

    // Verifica sovrapposizioni
    for (const apt of existingAppointments) {
      if (this.timesOverlap(startTime, endTime, apt.startTime, apt.endTime)) {
        return false;
      }
    }

    return true;
  }

  private timesOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string
  ): boolean {
    const [h1, m1] = start1.split(':').map(Number);
    const [h2, m2] = end1.split(':').map(Number);
    const [h3, m3] = start2.split(':').map(Number);
    const [h4, m4] = end2.split(':').map(Number);

    const time1Start = h1 * 60 + m1;
    const time1End = h2 * 60 + m2;
    const time2Start = h3 * 60 + m3;
    const time2End = h4 * 60 + m4;

    return (time1Start < time2End && time1End > time2Start);
  }
}
