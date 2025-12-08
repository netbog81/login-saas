import { InputType, Field, ID } from '@nestjs/graphql';
import { IsUUID, IsString, IsOptional, IsDateString, IsEnum, Matches } from 'class-validator';
import { GymExceptionType } from '../entities/gym-exception.entity';

@InputType()
export class CreateGymExceptionInput {
  @Field(() => ID)
  @IsUUID()
  gymRoomId: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  operatorId?: string;

  @Field()
  @IsDateString()
  exceptionDate: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime deve essere nel formato HH:mm'
  })
  startTime?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime deve essere nel formato HH:mm'
  })
  endTime?: string;

  @Field(() => GymExceptionType)
  @IsEnum(GymExceptionType)
  exceptionType: GymExceptionType;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  substituteOperatorId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reason?: string;
}

@InputType()
export class UpdateGymExceptionInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  operatorId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  exceptionDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime deve essere nel formato HH:mm'
  })
  startTime?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime deve essere nel formato HH:mm'
  })
  endTime?: string;

  @Field(() => GymExceptionType, { nullable: true })
  @IsOptional()
  @IsEnum(GymExceptionType)
  exceptionType?: GymExceptionType;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  substituteOperatorId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  reason?: string;
}
