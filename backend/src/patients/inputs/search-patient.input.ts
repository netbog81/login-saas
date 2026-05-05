import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';

/**
 * Input mappato direttamente al payload `POST /subjects/global-search` del registry.
 * Il backend clinico è "trasparente": forwarda al registry senza filtri locali.
 */
@InputType({ description: 'Input per ricerca paziente (proxy a registry global-search)' })
export class SearchPatientInput {
  @Field({ nullable: true, description: 'Testo libero (min 3 char)' })
  query?: string;

  @Field({
    nullable: true,
    description: 'INDIVIDUAL | ORGANIZATION (default: INDIVIDUAL)',
    defaultValue: 'INDIVIDUAL',
  })
  subjectType?: string;

  @Field({ nullable: true, description: 'Solo soggetti attivi (default: true)' })
  isActive?: boolean;

  @Field({
    nullable: true,
    description: 'Filtro consenso: given | not_given | revoked',
  })
  privacyConsent?: string;

  @Field(() => Int, { nullable: true, defaultValue: 1 })
  page?: number;

  @Field(() => Int, { nullable: true, defaultValue: 25 })
  pageSize?: number;
}

@ObjectType('PaginationInfo')
export class PaginationInfo {
  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  pageSize: number;

  @Field(() => Int)
  totalPages: number;
}
