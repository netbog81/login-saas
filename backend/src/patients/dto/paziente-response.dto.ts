// src/pazienti/dto/paziente-response.dto.ts
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

// IMPORT DAGLI ENUM CONDIVISI
import { StatoAnagrafica, StatoPrivacy } from '../enums/pazienti-enums';

export class PazienteResponseDto {
  id: string;
  nomeCompleto: string;
  eta: number;
  statoAnagrafica: StatoAnagrafica;
  statoPrivacy: StatoPrivacy;
  canCreateAppuntamento: boolean;
  canProceedToVisita: boolean;
  canEmitFattura: boolean;
  hasContattoTelefonico: boolean;
  telefonoPrincipale?: string;
  emailPrincipale?: string;
  createdAt: Date;
  updatedAt: Date;
}

// DTO PRIVACY

export class SetPrivacyDto {
  @IsEnum(['cartacea', 'digitale'], {
    message: 'Tipo privacy deve essere cartacea o digitale',
  })
  @IsNotEmpty()
  tipoPrivacy: 'cartacea' | 'digitale';

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  documentoPath?: string;
}

export class UpdateConsensiDto {
  @IsOptional()
  @IsBoolean()
  consensoMarketing?: boolean;

  @IsOptional()
  @IsBoolean()
  consensoRicercaMedica?: boolean;

  @IsOptional()
  @IsBoolean()
  modalitaConsensoPerTrattamento?: boolean;

  @IsOptional()
  @IsBoolean()
  consensoGdpr?: boolean;

  @IsOptional()
  @IsBoolean()
  consensoComunicazioneTerzi?: boolean;
}

// DTO WORKFLOW

export class WorkflowStateDto {
  @IsEnum(['promote_parziale', 'promote_completa', 'mark_verification'], {
    message: 'Azione non valida',
  })
  @IsNotEmpty()
  azione: 'promote_parziale' | 'promote_completa' | 'mark_verification';

  @IsOptional()
  @IsString()
  note?: string;
}

// DTO GDPR

export class GdprRequestDto {
  @IsEnum(['export_data', 'request_deletion', 'revoke_consent'], {
    message: 'Tipo richiesta GDPR non valida',
  })
  @IsNotEmpty()
  tipoRichiesta: 'export_data' | 'request_deletion' | 'revoke_consent';

  @IsOptional()
  @IsString()
  motivazione?: string;
}

// DTO FILTRI RICERCA

export class SearchPazientiDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  search?: string;

  @IsOptional()
  @IsEnum(StatoAnagrafica)
  @Transform(({ value }) => value?.trim())
  statoAnagrafica?: StatoAnagrafica;

  @IsOptional()
  @IsEnum(StatoPrivacy)
  @Transform(({ value }) => value?.trim())
  statoPrivacy?: StatoPrivacy;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const lower = value.toLowerCase().trim();
      if (lower === 'true' || lower === '1') {
        return true;
      }
      if (lower === 'false' || lower === '0') {
        return false;
      }
      return undefined;
    }
    return undefined;
  })
  soloMinorenni?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
