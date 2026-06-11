import { Module } from '@nestjs/common';
import { SeedService } from './seed.service';
import { User } from '../entities/user.entity';
import { Availability } from '../entities/availability.entity';

@Module({
  imports: [],
  providers: [SeedService],
})
export class SeedModule {}
