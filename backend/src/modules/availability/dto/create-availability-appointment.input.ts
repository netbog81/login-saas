import { InputType, Field, Int, ID, registerEnumType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsOptional, IsUUID, IsInt, Min, Max, IsArray, ValidateNested, IsBoolean, Matches, IsEmail, MaxLength, IsEnum, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Tipo di ricorrenza
 */
export enum RecurringType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly'
}

registerEnumType(RecurringType, {
  name: 'RecurringType',
  description: 'Tipo di ricorrenza per appuntamenti'
});

/**
 * Tipo di fine ricorrenza
 */
export enum RecurringEndType {
  NEVER = 'never',
  AFTER = 'after',
  UNTIL = 'until'
}

registerEnumType(RecurringEndType, {
  name: 'RecurringEndType',
  description: 'Modalità di fine ricorrenza'
});

/**
 * Input per la configurazione della ricorrenza
 */
@InputType()
export class RepeatConfigInput {
  @Field(() => RecurringType)
  @IsEnum(RecurringType, { message: 'Tipo di ricorrenza non valido' })
  type: RecurringType;

  @Field(() => Int)
  @IsInt()
  @Min(1, { message: "L'intervallo deve essere almeno 1" })
  @Max(12, { message: "L'intervallo non può superare 12" })
  interval: number;

  @Field(() => [Int], { nullable: true, description: 'Giorni della settimana (0=Dom, 1=Lun, ..., 6=Sab) per ricorrenza settimanale' })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  selectedDays?: number[];

  @Field(() => RecurringEndType)
  @IsEnum(RecurringEndType, { message: 'Tipo di fine ricorrenza non valido' })
  endType: RecurringEndType;

  @Field(() => Int, { nullable: true, description: 'Numero di occorrenze (se endType = AFTER)' })
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Il numero di occorrenze deve essere almeno 1' })
  @Max(52, { message: 'Il numero massimo di occorrenze è 52' })
  occurrences?: number;

  @Field({ nullable: true, description: 'Data di fine (se endType = UNTIL)' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La data di fine deve essere nel formato YYYY-MM-DD' })
  untilDate?: string;
}

/**
 * Input per un singolo servizio nell'appuntamento
 */
@InputType()
export class ServiceInputItem {
  @Field(() => ID)
  @IsNotEmpty({ message: 'Il servizio è obbligatorio' })
  @IsUUID('4', { message: 'ID servizio non valido' })
  serviceId: string;

  @Field(() => Int, { nullable: true, description: 'Durata personalizzata in minuti (override del default)' })
  @IsOptional()
  @IsInt()
  @Min(5, { message: 'La durata minima è 5 minuti' })
  @Max(480, { message: 'La durata massima è 480 minuti (8 ore)' })
  customDuration?: number;

  @Field({ nullable: true, description: 'Prezzo personalizzato (override del default)' })
  @IsOptional()
  @Min(0, { message: 'Il prezzo non può essere negativo' })
  customPrice?: number;

  @Field(() => Int, { nullable: true, description: 'Posizione ordine del servizio nell\'appuntamento' })
  @IsOptional()
  @IsInt()
  @Min(0, { message: 'La posizione ordine deve essere >= 0' })
  orderPosition?: number;
}

@InputType()
export class AppointmentInstrumentInput {
  @Field()
  @IsNotEmpty({ message: 'La categoria strumento è obbligatoria' })
  @IsUUID('4', { message: 'ID categoria strumento non valido' })
  instrumentCategoryId: string;

  @Field(() => Int)
  @IsInt()
  @Min(0, { message: 'startOffsetMinutes deve essere >= 0' })
  @Max(45, { message: 'startOffsetMinutes deve essere <= 45' })
  startOffsetMinutes: number;

  @Field(() => Int)
  @IsInt()
  @Min(15, { message: 'endOffsetMinutes deve essere >= 15' })
  @Max(60, { message: 'endOffsetMinutes deve essere <= 60' })
  endOffsetMinutes: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2)
  orderPosition?: number;
}

@InputType()
export class CreateAvailabilityAppointmentInput {
  @Field(() => ID)
  @IsNotEmpty({ message: "L'operatore è obbligatorio" })
  @IsUUID('4', { message: 'ID operatore non valido' })
  operatorId: string;

  /**
   * @deprecated Usa services invece. Mantenuto per retrocompatibilità.
   */
  @Field(() => ID, { nullable: true, deprecationReason: 'Usa services invece' })
  @IsOptional()
  @IsUUID('4', { message: 'ID servizio non valido' })
  serviceId?: string;

  /**
   * Lista dei servizi da associare all'appuntamento.
   * Se fornito, sostituisce serviceId.
   */
  @Field(() => [ServiceInputItem], { nullable: true, description: 'Servizi da associare all\'appuntamento' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceInputItem)
  services?: ServiceInputItem[];

  @Field()
  @IsNotEmpty({ message: 'Il nome cliente è obbligatorio' })
  @IsString()
  @MaxLength(255, { message: 'Il nome cliente non può superare 255 caratteri' })
  clientName: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsEmail({}, { message: 'Email non valida' })
  @MaxLength(255)
  clientEmail?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'Numero di telefono troppo lungo' })
  clientPhone?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  patientId?: number;

  @Field()
  @IsNotEmpty({ message: 'La data è obbligatoria' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La data deve essere nel formato YYYY-MM-DD' })
  appointmentDate: string;

  @Field()
  @IsNotEmpty({ message: "L'orario di inizio è obbligatorio" })
  @Matches(/^\d{2}:\d{2}$/, { message: "L'orario deve essere nel formato HH:mm" })
  startTime: string;

  @Field()
  @IsNotEmpty({ message: "L'orario di fine è obbligatorio" })
  @Matches(/^\d{2}:\d{2}$/, { message: "L'orario deve essere nel formato HH:mm" })
  endTime: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Le note non possono superare 2000 caratteri' })
  notes?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  instrumentOrderMatters?: boolean;

  @Field(() => [AppointmentInstrumentInput], { nullable: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AppointmentInstrumentInput)
  instruments?: AppointmentInstrumentInput[];

  @Field(() => RepeatConfigInput, { nullable: true, description: 'Configurazione per appuntamenti ricorrenti' })
  @IsOptional()
  @ValidateNested()
  @Type(() => RepeatConfigInput)
  repeatConfig?: RepeatConfigInput;

  @Field({ nullable: true, description: 'Appuntamento non retribuito (pausa pranzo, rappresentante, etc.)' })
  @IsOptional()
  @IsBoolean()
  nonRetribuito?: boolean;
}
