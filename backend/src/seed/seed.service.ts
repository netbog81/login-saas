import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Availability } from '../entities/availability.entity';

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Availability)
    private availabilitiesRepository: Repository<Availability>,
  ) {}

  async onModuleInit() {
    await this.seedUsers();
    // Niente seedPatients: l'anagrafica vive nel registry, popolata via UI registry
    // o tramite import bulk dal legacy MySQL.
    await this.seedAvailabilities();
  }

  private async seedUsers() {
    const count = await this.usersRepository.count();
    if (count > 0) {
      console.log('✓ Users already seeded');
      return;
    }

    const users = [
      { name: 'Dr. Mario Rossi', type: 'medico', color: '#4285f4', active: true },
      { name: 'Dr.ssa Laura Bianchi', type: 'medico', color: '#ea4335', active: true },
      { name: 'Ft. Giuseppe Verdi', type: 'fisioterapista', color: '#34a853', active: true },
      { name: 'Dr.ssa Anna Neri', type: 'medico', color: '#fbbc04', active: true },
      { name: 'Ft. Marco Blu', type: 'fisioterapista', color: '#9c27b0', active: true },
    ];

    await this.usersRepository.save(users);
    console.log('✓ Users seeded successfully');
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
          available: true,
        });
      }
    }

    await this.availabilitiesRepository.save(availabilities);
    console.log('✓ Availabilities seeded successfully');
  }
}
