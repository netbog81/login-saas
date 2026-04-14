import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

@InputType()
export class CreateOperatorAbsenceTypeInput {
  @Field()
  @IsString()
  @MaxLength(255)
  name: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;
}

@InputType()
export class UpdateOperatorAbsenceTypeInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
