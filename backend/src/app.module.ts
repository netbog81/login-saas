import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { PatientsModule } from './patients/patients.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { AvailabilitiesModule } from './availabilities/availabilities.module';
import { SeedModule } from './seed/seed.module';
import { User } from './entities/user.entity';
import { Patient } from './entities/patient.entity';
import { Appointment } from './entities/appointment.entity';
import { Availability } from './entities/availability.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_DATABASE || 'calendar_db',
      entities: [User, Patient, Appointment, Availability],
      synchronize: true, // Solo per sviluppo! Usare migrations in produzione
      logging: process.env.NODE_ENV === 'development',
    }),
    UsersModule,
    PatientsModule,
    AppointmentsModule,
    AvailabilitiesModule,
    SeedModule,
  ],
})
export class AppModule {}
