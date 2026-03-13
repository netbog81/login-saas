import { InputType, Field, Int, ID } from '@nestjs/graphql';
import { IsOptional, IsUUID, IsInt, Min, Max, IsString, MaxLength, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { WaitingListStatus } from '../entities/waiting-list-entry.entity';

@InputType()
export class CreateWaitingListEntryInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID('4', { message: 'ID paziente non valido' })
  patientId?: string;

  @Field()
  @IsString()
  @MaxLength(255, { message: 'Il nome paziente non può superare 255 caratteri' })
  patientName: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'Il numero di telefono non può superare 50 caratteri' })
  phone?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID('4', { message: 'ID operatore non valido' })
  operatorId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Le note non possono superare 2000 caratteri' })
  notes?: string;

  @Field(() => Int, { defaultValue: 1 })
  @IsInt()
  @Min(1, { message: 'La priorità minima è 1' })
  @Max(5, { message: 'La priorità massima è 5' })
  priority: number;
}

@InputType()
export class UpdateWaitingListEntryInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  patientName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID('4', { message: 'ID operatore non valido' })
  operatorId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  priority?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @Field(() => WaitingListStatus, { nullable: true })
  @IsOptional()
  @IsEnum(WaitingListStatus)
  status?: WaitingListStatus;
}

@InputType()
export class ReorderEntryItem {
  @Field(() => ID)
  @IsUUID('4')
  id: string;

  @Field(() => Int)
  @IsInt()
  @Min(0)
  position: number;
}

@InputType()
export class ReorderWaitingListInput {
  @Field(() => [ReorderEntryItem])
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderEntryItem)
  entries: ReorderEntryItem[];
}
