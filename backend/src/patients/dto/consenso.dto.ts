// src/pazienti/dto/consenso.dto.ts
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
  IsUUID,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

// IMPORT DAGLI ENUM CONDIVISI
import {
  TipoConsensoRichiesto,
  TipoTrattamentoConsenso,
} from '../enums/pazienti-enums';

export class CreateConsensoRequestDto {
  @IsUUID('4', { message: 'ID paziente deve essere un UUID valido' })
  pazienteId: string;

  @IsUUID('4', { message: 'ID persona riferimento deve essere un UUID valido' })
  personaRiferimentoId: string;

  @IsOptional()
  @IsEnum(TipoTrattamentoConsenso, { message: 'Tipo trattamento non valido' })
  tipoTrattamento?: TipoTrattamentoConsenso;

  @IsOptional()
  @IsEnum(TipoConsensoRichiesto, { message: 'Tipo consenso richiesto non valido' })
  tipoConsensoRichiesto?: TipoConsensoRichiesto;

  @IsOptional()
  @IsNumber({}, { message: 'Età minima deve essere numerica' })
  @Min(14)
  @Max(18)
  @Type(() => Number)
  etaMinimaConsensoAutonomo?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Età limite deve essere numerica' })
  @Min(14)
  @Max(25)
  @Type(() => Number)
  richiedeConsensoFinoEta?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Scadenza deve essere numerica' })
  @Min(1)
  @Max(60)
  @Type(() => Number)
  dataScadenzaMesi?: number;
}

export class ConsensoResponseDto {
  @IsUUID('4', { message: 'ID paziente deve essere un UUID valido' })
  pazienteId: string;

  @IsUUID('4', { message: 'ID persona riferimento deve essere un UUID valido' })
  personaRiferimentoId: string;

  @IsBoolean({ message: 'Consenso dato deve essere boolean' })
  consensoDato: boolean;

  @IsEnum(['cartaceo', 'digitale', 'verbale', 'telefono'], {
    message: 'Modalità consenso non valida',
  })
  @IsNotEmpty()
  modalitaConsenso: string;

  @IsOptional()
  @IsString()
  documentoConsenso?: string;

  @IsOptional()
  @IsString()
  firmaDigitale?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateConsensoDto {
  @IsOptional()
  @IsEnum(['cartaceo', 'digitale', 'verbale', 'telefono'], {
    message: 'Modalità consenso non valida',
  })
  modalita?: string;

  @IsOptional()
  @IsString()
  documento?: string;

  @IsOptional()
  @IsString()
  firmaDigitale?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Scadenza deve essere numerica' })
  @Min(1)
  @Max(60)
  @Type(() => Number)
  scadenzaMesi?: number;
}

export class RevokeConsensoDto {
  @IsString()
  @IsNotEmpty({ message: 'Motivo revoca richiesto' })
  motivo: string;

  @IsOptional()
  @IsString()
  noteAggiuntive?: string;
}

export class CheckConsensoDto {
  @IsUUID('4', { message: 'ID paziente deve essere un UUID valido' })
  pazienteId: string;

  @IsEnum(TipoTrattamentoConsenso, { message: 'Tipo trattamento non valido' })
  tipoTrattamento: TipoTrattamentoConsenso;
}

export class ConsensoCheckResultDto {
  consensoValido: boolean;
  consensiRichiesti: any[];
  consensiOttenuti: any[];
  motivoRifiuto?: string;
}

export class ConsensiScadentiDto {
  @IsOptional()
  @IsNumber({}, { message: 'Giorni deve essere numerico' })
  @Min(1)
  @Max(365)
  @Type(() => Number)
  giorni?: number;
}
