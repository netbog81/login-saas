import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProcessedRegistryEvent } from './processed-event.entity';
import { RegistryEventsConfig } from './registry-events.config';
import { RegistrySubjectsConsumer } from './registry-subjects.consumer';
import { PazientiModule } from '../../patients/patients.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([ProcessedRegistryEvent]),
    PazientiModule,
  ],
  providers: [RegistryEventsConfig, RegistrySubjectsConsumer],
  exports: [RegistryEventsConfig],
})
export class RegistryEventsModule {}
