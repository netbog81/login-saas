import { InputType, Field, ID, Int } from '@nestjs/graphql';

/** Generazione conteggi FE: snapshot immutabile per gli operatori scelti. */
@InputType()
export class GenerateOperatorFeSettlementsInput {
  /** 'YYYY-MM-DD' inclusivo. */
  @Field(() => String)
  from: string;

  @Field(() => String)
  to: string;

  /** AppUser.id degli operatori da conteggiare. */
  @Field(() => [ID])
  operatorAppUserIds: string[];

  /** Include le prestazioni chiuse ma non incassate. */
  @Field({ defaultValue: false })
  includeUnpaid: boolean;

  /** Include le prestazioni di trattamenti non ancora chiusi. */
  @Field({ defaultValue: false })
  includeOpen: boolean;
}

/**
 * Workflow di un conteggio salvato. I boolean pilotano i timestamp
 * (true → set se assente, false → azzera). Campo assente = non toccare.
 */
@InputType()
export class PatchOperatorFeSettlementInput {
  @Field({ nullable: true })
  communicated?: boolean;

  @Field({ nullable: true })
  verified?: boolean;

  @Field({ nullable: true })
  paid?: boolean;

  /** 'YYYY-MM-DD'; null esplicito azzera. */
  @Field(() => String, { nullable: true })
  paymentDate?: string | null;

  @Field(() => String, { nullable: true })
  notes?: string | null;
}

@InputType()
export class UpdateOperatorFeAccountSettingsInput {
  @Field({ nullable: true })
  periodMode?: 'CALENDAR_MONTH' | 'CUTOFF';

  @Field(() => Int, { nullable: true })
  cutoffDay?: number;
}
