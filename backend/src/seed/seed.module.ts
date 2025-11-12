import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import { User } from '../entities/user.entity';
import { Patient } from '../entities/patient.entity';
import { Availability } from '../entities/availability.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Patient, Availability])],
  providers: [SeedService],
})
export class SeedModule {}
