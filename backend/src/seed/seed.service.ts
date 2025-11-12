import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Patient } from '../entities/patient.entity';
import { Availability } from '../entities/availability.entity';

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Patient)
    private patientsRepository: Repository<Patient>,
    @InjectRepository(Availability)
    private availabilitiesRepository: Repository<Availability>,
  ) {}

  async onModuleInit() {
    await this.seedUsers();
    await this.seedPatients();
    await this.seedAvailabilities();
  }

  private async seedUsers() {
    const count = await this.usersRepository.count();
    if (count > 0) {
      console.log('✓ Users already seeded');
      return;
    }

    const users = [
      {
        name: 'Dr. Mario Rossi',
        type: 'medico',
        color: '#4285f4',
        active: true
      },
      {
        name: 'Dr.ssa Laura Bianchi',
        type: 'medico',
        color: '#ea4335',
        active: true
      },
      {
        name: 'Ft. Giuseppe Verdi',
        type: 'fisioterapista',
        color: '#34a853',
        active: true
      },
      {
        name: 'Dr.ssa Anna Neri',
        type: 'medico',
        color: '#fbbc04',
        active: true
      },
      {
        name: 'Ft. Marco Blu',
        type: 'fisioterapista',
        color: '#9c27b0',
        active: true
      }
    ];

    await this.usersRepository.save(users);
    console.log('✓ Users seeded successfully');
  }

  private async seedPatients() {
    const count = await this.patientsRepository.count();
    if (count > 0) {
      console.log('✓ Patients already seeded');
      return;
    }

    const patients = [
      {
        name: 'Giovanni',
        surname: 'Bianchi',
        phone: '333 1234567',
        email: 'giovanni.bianchi@example.com'
      },
      {
        name: 'Maria',
        surname: 'Rossi',
        phone: '339 8765432',
        email: 'maria.rossi@example.com'
      },
      {
        name: 'Luigi',
        surname: 'Verdi',
        phone: '340 5555555',
        email: 'luigi.verdi@example.com'
      },
      {
        name: 'Anna',
        surname: 'Neri',
        phone: '347 9876543',
        email: 'anna.neri@example.com'
      },
      {
        name: 'Paolo',
        surname: 'Gialli',
        phone: '348 1111111',
        email: 'paolo.gialli@example.com'
      }
    ];

    await this.patientsRepository.save(patients);
    console.log('✓ Patients seeded successfully');
  }

  private async seedAvailabilities() {
    const count = await this.availabilitiesRepository.count();
    if (count > 0) {
      console.log('✓ Availabilities already seeded');
      return;
    }

    const users = await this.usersRepository.find();
    const availabilities = [];

    // Crea disponibilità per i prossimi 30 giorni, dalle 08:00 alle 18:00
    for (const user of users) {
      for (let i = 0; i < 30; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];

        availabilities.push({
          userId: user.id,
          date: dateStr,
          startTime: '08:00',
          endTime: '18:00',
          available: true
        });
      }
    }

    await this.availabilitiesRepository.save(availabilities);
    console.log('✓ Availabilities seeded successfully');
  }
}
