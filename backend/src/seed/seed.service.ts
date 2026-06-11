import { Injectable, OnModuleInit } from '@nestjs/common';
import { User } from '../entities/user.entity';
import { Availability } from '../entities/availability.entity';

import { TenantContextService } from '@curandis/tenant-datasource';
@Injectable()
export class SeedService implements OnModuleInit {
  constructor(
    private readonly tenantContext: TenantContextService,
  ){}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get usersRepository() { return this.dataSource.getRepository(User); }

  private get availabilitiesRepository() { return this.dataSource.getRepository(Availability); }

  // NOTA containerization-2026-06-11: rimosso `onModuleInit` che chiamava
  // seedUsers/seedAvailabilities. In architettura DB-per-tenant non c'è
  // un AsyncLocalStorage context al boot. Seed va fatto per-tenant al
  // provisioning o via script CLI standalone. Per bdq i dati sono già in DB.
  async onModuleInit() {
    // no-op
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
