import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  ValidateNested,
  IsBoolean,
  IsArray,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RepeatConfigDto {
  @IsBoolean()
  enabled: boolean;

  @IsString()
  type: string;

  @IsNumber()
  interval: number;

  @IsArray()
  @IsNumber({}, { each: true })
  selectedDays: number[];

  @IsString()
  endType: string;

  @IsNumber()
  occurrences: number;

  @IsString()
  untilDate: string;
}

export class CreateAppointmentDto {
  // Campo id opzionale - il frontend lo invia come 0 per nuovi appuntamenti
  // Verrà ignorato dal service durante la creazione
  @IsOptional()
  @IsNumber()
  id?: number;

  @IsString()
  title: string;

  @IsDateString()
  date: string;

  @IsString()
  startTime: string;

  @IsString()
  endTime: string;

  @IsUUID()
  operatorId: string;

  @IsOptional()
  @IsNumber()
  patientId?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => RepeatConfigDto)
  repeat?: RepeatConfigDto;
}
