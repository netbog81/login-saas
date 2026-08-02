import { Field, ID, InputType, Int, Float } from '@nestjs/graphql';

import { NoShowContext, NoShowEventType } from '../models/no-show.models';
import { NoShowDecision } from '../entities/no-show-review.entity';

/**
 * Filtro condiviso da tutte le query della pagina No Show: elenco piatto,
 * vista ad albero per paziente e riepilogo KPI leggono lo stesso insieme.
 */
@InputType()
export class NoShowFilterInput {
  @Field(() => String, { nullable: true, description: 'Da (YYYY-MM-DD), inclusivo' })
  from?: string;

  @Field(() => String, { nullable: true, description: 'A (YYYY-MM-DD), inclusivo' })
  to?: string;

  @Field(() => [NoShowEventType], {
    nullable: true,
    description:
      'Tipologie da includere. Default: NO_SHOW + CANCELLED_LATE + CANCELLED_UNKNOWN ' +
      '(le assenze che pesano). Le disdette con preavviso vanno chieste esplicitamente.',
  })
  types?: NoShowEventType[];

  @Field(() => NoShowContext, {
    nullable: true,
    description: 'Studio (operatori/medici), palestra (istruttori) o entrambi. Default ALL.',
  })
  context?: NoShowContext;

  @Field(() => [ID], { nullable: true, description: 'Operatori/medici/istruttori di riferimento' })
  operatorIds?: string[];

  @Field(() => [ID], { nullable: true })
  siteIds?: string[];

  @Field(() => ID, { nullable: true, description: 'Un singolo paziente (subjectId)' })
  patientId?: string;

  @Field({ nullable: true, description: 'Ricerca sul nome del paziente' })
  search?: string;

  @Field(() => [NoShowDecision], {
    nullable: true,
    description: 'Filtra per esito della valutazione staff. PENDING include gli eventi mai valutati.',
  })
  decisions?: NoShowDecision[];

  @Field({
    nullable: true,
    description:
      'Escludi gli eventi già marcati come giustificati. Default true: un\'assenza ' +
      'con certificato non deve inquinare il conteggio.',
  })
  excludeJustified?: boolean;

  @Field({
    nullable: true,
    description: 'Includi gli appuntamenti senza paziente collegato (clienti occasionali). Default false.',
  })
  includeWithoutPatient?: boolean;

  @Field(() => Int, {
    nullable: true,
    description: 'Solo pazienti con almeno N eventi nel periodo (vista ad albero). Default 1.',
  })
  minEvents?: number;
}

@InputType()
export class NoShowPagingInput {
  @Field(() => Int, { nullable: true, defaultValue: 50 })
  limit?: number;

  @Field(() => Int, { nullable: true, defaultValue: 0 })
  offset?: number;
}

@InputType()
export class UpsertNoShowReviewInput {
  @Field(() => ID)
  appointmentId: string;

  @Field(() => NoShowDecision)
  decision: NoShowDecision;

  @Field({ nullable: true })
  notes?: string;

  @Field(() => Float, { nullable: true, description: 'Importo addebitato, se deciso' })
  chargedAmount?: number;
}
