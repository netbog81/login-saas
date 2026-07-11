import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsOptional, MaxLength, IsBoolean, IsEnum, IsObject } from 'class-validator';
import { GraphQLJSON } from 'graphql-type-json';
import { DocumentTemplateType } from '../entities/document-template.entity';

@InputType()
export class CreateDocumentTemplateInput {
  @Field()
  @IsString()
  @MaxLength(255, { message: 'Il nome non può superare 255 caratteri' })
  name: string;

  @Field(() => DocumentTemplateType, { nullable: true })
  @IsOptional()
  @IsEnum(DocumentTemplateType, { message: 'Tipo template non valido' })
  type?: DocumentTemplateType;

  @Field(() => GraphQLJSON)
  @IsObject({ message: 'Il contenuto deve essere un documento JSON' })
  content: Record<string, unknown>;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  @IsObject()
  pageSettings?: Record<string, unknown>;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

@InputType()
export class UpdateDocumentTemplateInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Il nome non può superare 255 caratteri' })
  name?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  @IsObject({ message: 'Il contenuto deve essere un documento JSON' })
  content?: Record<string, unknown>;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  @IsObject()
  pageSettings?: Record<string, unknown>;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
