// src/pazienti/dto/create-paziente.dto.ts
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
import { Genere, StatoCivile, TipoPaziente } from '../enums/pazienti-enums';

export class CreatePazienteDto {
  @IsString()
  @IsNotEmpty({ message: 'Nome richiesto' })
  @Length(1, 50, { message: 'Nome deve essere tra 1 e 50 caratteri' })
  nome: string;

  @IsString()
  @IsNotEmpty({ message: 'Cognome richiesto' })
  @Length(1, 50, { message: 'Cognome deve essere tra 1 e 50 caratteri' })
  cognome: string;

  @IsOptional()
  @IsString()
  @Length(16, 16, { message: 'Codice fiscale deve essere di 16 caratteri' })
  codiceFiscale?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Data nascita deve essere in formato valido' })
  dataNascita?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  comuneNascita?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  nazioneNascita?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  luogoNascitaEstero?: string;

  @IsOptional()
  @IsEnum(Genere, { message: 'Genere non valido' })
  genere?: Genere;

  @IsOptional()
  @IsEnum(StatoCivile, { message: 'Stato civile non valido' })
  statoCivile?: StatoCivile;

  // CONTATTI

  @IsOptional()
  @IsString()
  @Length(1, 100)
  indirizzo?: string;

  @IsOptional()
  @IsString()
  @Length(5, 20)
  cap?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  citta?: string;

  @IsOptional()
  @IsString()
  @Length(2, 5)
  provincia?: string;

  @IsOptional()
  @IsString()
  @Length(6, 20)
  telefono?: string;

  @IsOptional()
  @IsString()
  @Length(6, 20)
  cellulare?: string;

  @IsOptional()
  @IsString()
  @Length(6, 20)
  fax?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email non valida' })
  @Length(1, 100)
  email?: string;

  @IsOptional()
  @IsEmail({}, { message: 'PEC non valida' })
  @Length(1, 100)
  pec?: string;

  @IsOptional()
  @IsString()
  @Length(7, 10)
  codiceSdi?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  nazioneResidenza?: string;

  // DATI SANITARI

  @IsOptional()
  @IsEnum(TipoPaziente, { message: 'Tipo paziente non valido' })
  tipoPaziente?: TipoPaziente;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  medicoBase?: string;

  @IsOptional()
  @IsString()
  @Length(1, 5)
  gruppoSanguigno?: string;

  @IsOptional()
  @IsString()
  allergie?: string;

  @IsOptional()
  @IsString()
  farmaciInUso?: string;

  @IsOptional()
  @IsString()
  patologieCroniche?: string;

  // CONSENSI

  @IsOptional()
  @IsBoolean()
  consensoMarketing?: boolean;

  @IsOptional()
  @IsBoolean()
  consensoRicercaMedica?: boolean;

  @IsOptional()
  @IsBoolean()
  modalitaConsensoPerTrattamento?: boolean;

  // NOTE

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  noteAmministrative?: string;
}
