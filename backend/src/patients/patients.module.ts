// Pazienti Module Configuration
// This module provides complete patient management with GraphQL API

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { Patient } from '../entities/patient.entity';
import { PersonaRiferimento } from './entities/persona-riferimento.entity';
import { PazientePersonaRelazione } from './entities/paziente-persona-relazione.entity';

// Services
import { PazientiService } from './services/patients.service';
import { PazientiRelazioniService } from './services/patients-relazioni.service';

// GraphQL Resolvers
import { PatientsResolver } from './resolvers/patients.resolver';

// GraphQL Enum Registration
// NOTE: Import this in your app.module.ts to register enums globally
import './models/graphql-enums';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Patient,
      PersonaRiferimento,
      PazientePersonaRelazione,
    ]),
  ],
  providers: [
    // Services
    PazientiService,
    PazientiRelazioniService,

    // GraphQL Resolvers
    PatientsResolver,
  ],
  exports: [
    // Export services so other modules can use them
    PazientiService,
    PazientiRelazioniService,
  ],
})
export class PazientiModule {}
