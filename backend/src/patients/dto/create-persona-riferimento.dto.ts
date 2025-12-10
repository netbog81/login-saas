// src/pazienti/dto/create-persona-riferimento.dto.ts
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsEnum,
  IsDateString,
  Length,
  IsBoolean,
} from 'class-validator';

// IMPORT DAGLI ENUM CONDIVISI
import {
  TipoRiferimento,
  TipoPatriaPodesta,
  Genere,
} from '../enums/pazienti-enums';

export class CreatePersonaRiferimentoDto {
  @IsString()
  @IsNotEmpty({ message: 'Nome richiesto' })
  @Length(1, 50)
  nome: string;

  @IsString()
  @IsNotEmpty({ message: 'Cognome richiesto' })
  @Length(1, 50)
  cognome: string;

  @IsOptional()
  @IsString()
  @Length(16, 16)
  codiceFiscale?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Data nascita deve essere in formato valido' })
  dataNascita?: string;

  @IsOptional()
  @IsEnum(Genere, { message: 'Genere non valido' })
  genere?: Genere;

  @IsOptional()
  @IsString()
  @Length(6, 20)
  telefono?: string;

  @IsOptional()
  @IsString()
  @Length(6, 20)
  cellulare?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email non valida' })
  @Length(1, 100)
  email?: string;

  @IsOptional()
  @IsString()
  indirizzo?: string;

  @IsEnum(TipoRiferimento, { message: 'Tipo riferimento non valido' })
  @IsNotEmpty()
  tipoRiferimento: TipoRiferimento;

  @IsOptional()
  @IsEnum(TipoPatriaPodesta, { message: 'Tipo patria podestà non valido' })
  tipoPatriaPodesta?: TipoPatriaPodesta;

  @IsOptional()
  @IsBoolean()
  puoDareConsenso?: boolean;

  @IsOptional()
  @IsBoolean()
  puoAccedereCartella?: boolean;

  @IsOptional()
  @IsBoolean()
  puoRitirareReferti?: boolean;

  @IsOptional()
  @IsBoolean()
  puoPrenotareVisite?: boolean;

  @IsOptional()
  @IsBoolean()
  puoRicevereFatture?: boolean;

  @IsOptional()
  @IsDateString({}, { message: 'Data inizio deve essere in formato valido' })
  dataInizio?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Data fine deve essere in formato valido' })
  dataFine?: string;

  @IsOptional()
  @IsString()
  documentoNomina?: string;

  @IsOptional()
  @IsString()
  numeroPraticaTribunale?: string;

  @IsOptional()
  @IsString()
  tribunaleCompetente?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Data nomina legale deve essere in formato valido' })
  dataNominaLegale?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdatePersonaRiferimentoDto {
  @IsOptional()
  @IsString()
  @Length(1, 50)
  nome?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  cognome?: string;

  @IsOptional()
  @IsString()
  @Length(6, 20)
  telefono?: string;

  @IsOptional()
  @IsString()
  @Length(6, 20)
  cellulare?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email non valida' })
  email?: string;

  @IsOptional()
  @IsString()
  indirizzo?: string;

  @IsOptional()
  @IsBoolean()
  puoDareConsenso?: boolean;

  @IsOptional()
  @IsBoolean()
  puoAccedereCartella?: boolean;

  @IsOptional()
  @IsBoolean()
  puoRitirareReferti?: boolean;

  @IsOptional()
  @IsBoolean()
  puoPrenotareVisite?: boolean;

  @IsOptional()
  @IsBoolean()
  puoRicevereFatture?: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}

export class RemovePersonaRiferimentoDto {
  @IsString()
  @IsNotEmpty({ message: 'Motivo richiesto' })
  motivo: string;

  @IsOptional()
  @IsString()
  noteAggiuntive?: string;
}
