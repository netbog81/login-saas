// src/pazienti/dto/update-paziente.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreatePazienteDto } from './create-paziente.dto';

export class UpdatePazienteDto extends PartialType(CreatePazienteDto) {
  // Tutti i campi di CreatePazienteDto sono opzionali per l'update
}
