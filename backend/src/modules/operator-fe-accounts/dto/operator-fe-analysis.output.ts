import { ObjectType, Field, ID, Int, Float } from '@nestjs/graphql';

/**
 * Output dell'analisi Conti FE (calcolo live, nulla di persistito).
 * Stati riga: PAID = incassata, UNPAID = chiusa da incassare,
 * OPEN = trattamento non ancora chiuso.
 */
@ObjectType('OperatorFeAnalysisRow')
export class OperatorFeAnalysisRow {
  @Field(() => ID)
  treatmentId: string;

  @Field(() => ID)
  treatmentServiceId: string;

  @Field(() => String)
  executionDate: string;

  @Field()
  description: string;

  @Field({ nullable: true })
  serviceName?: string | null;

  @Field({ nullable: true })
  patientName?: string | null;

  @Field(() => Float)
  unitPrice: number;

  @Field(() => Float)
  studioExtraAmount: number;

  @Field(() => Float)
  baseAmount: number;

  @Field(() => Float)
  percentage: number;

  @Field(() => Float)
  compensationAmount: number;

  @Field(() => Float)
  studioShareAmount: number;

  @Field()
  state: string;

  @Field()
  isCustomPrice: boolean;

  /** true se il servizio non ha la scomposizione Extra studio FE (extra = 0). */
  @Field()
  missingBreakdown: boolean;
}

@ObjectType('OperatorFeAnalysisCounts')
export class OperatorFeAnalysisCounts {
  @Field(() => Int) total: number;
  @Field(() => Int) paid: number;
  @Field(() => Int) unpaid: number;
  @Field(() => Int) open: number;
}

@ObjectType('OperatorFeAnalysisTotals')
export class OperatorFeAnalysisTotals {
  @Field(() => Float) gross: number;
  @Field(() => Float) base: number;
  @Field(() => Float) compensation: number;
  @Field(() => Float) studioShare: number;
  @Field(() => Float) studioExtra: number;
}

@ObjectType('OperatorFeAnalysis')
export class OperatorFeAnalysis {
  @Field(() => ID)
  operatorAppUserId: string;

  @Field()
  operatorName: string;

  /** false se nessuna scheda Operatore è collegata a quell'AppUser (percentuale 0). */
  @Field()
  hasOperator: boolean;

  @Field(() => Float)
  royaltyPercentage: number;

  @Field(() => OperatorFeAnalysisCounts)
  counts: OperatorFeAnalysisCounts;

  @Field(() => OperatorFeAnalysisTotals)
  totals: OperatorFeAnalysisTotals;

  @Field(() => [OperatorFeAnalysisRow])
  rows: OperatorFeAnalysisRow[];
}

@ObjectType('BulkDeleteOperatorFeSettlementsResult')
export class BulkDeleteOperatorFeSettlementsResult {
  @Field(() => Int) deleted: number;
  /** Conteggi saltati perché già pagati. */
  @Field(() => Int) skippedPaid: number;
}
