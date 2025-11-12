import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Availability } from '../entities/availability.entity';

@Injectable()
export class AvailabilitiesService {
  constructor(
    @InjectRepository(Availability)
    private availabilitiesRepository: Repository<Availability>,
  ) {}

  async findByDateRange(
    startDate: string,
    endDate: string,
    userId?: number
  ): Promise<Availability[]> {
    const where: any = {
      date: Between(startDate, endDate)
    };

    if (userId) {
      where.userId = userId;
    }

    return this.availabilitiesRepository.find({
      where,
      relations: ['user'],
      order: { date: 'ASC', startTime: 'ASC' }
    });
  }

  async findByDate(date: string, userId?: number): Promise<Availability[]> {
    const where: any = { date };

    if (userId) {
      where.userId = userId;
    }

    return this.availabilitiesRepository.find({
      where,
      relations: ['user'],
      order: { startTime: 'ASC' }
    });
  }

  findOne(id: number): Promise<Availability> {
    return this.availabilitiesRepository.findOne({
      where: { id },
      relations: ['user']
    });
  }

  create(availabilityData: Partial<Availability>): Promise<Availability> {
    const availability = this.availabilitiesRepository.create(availabilityData);
    return this.availabilitiesRepository.save(availability);
  }

  async createBulk(availabilities: Partial<Availability>[]): Promise<Availability[]> {
    const entities = availabilities.map(data =>
      this.availabilitiesRepository.create(data)
    );
    return this.availabilitiesRepository.save(entities);
  }

  async update(id: number, availabilityData: Partial<Availability>): Promise<Availability> {
    await this.availabilitiesRepository.update(id, availabilityData);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.availabilitiesRepository.delete(id);
  }

  async setDefaultAvailability(
    userId: number,
    startDate: string,
    endDate: string,
    startTime: string,
    endTime: string
  ): Promise<Availability[]> {
    const availabilities: Partial<Availability>[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dateStr = date.toISOString().split('T')[0];

      // Verifica se esiste già una disponibilità per questo giorno
      const existing = await this.availabilitiesRepository.findOne({
        where: {
          userId,
          date: dateStr,
          startTime,
          endTime
        }
      });

      if (!existing) {
        availabilities.push({
          userId,
          date: dateStr,
          startTime,
          endTime,
          available: true
        });
      }
    }

    return this.createBulk(availabilities);
  }
}
