import { Resolver, Query, Mutation, Args, ID, Int } from '@nestjs/graphql';
import { Treatment } from '../entities/treatment.entity';
import { TreatmentService } from '../services/treatment.service';
import {
  CompleteTreatmentInput,
  CloseTreatmentInput,
  RecordPaymentInput,
  TreatmentInstrumentInput,
} from '../dto/treatment.input';

@Resolver(() => Treatment)
export class TreatmentResolver {
  constructor(private readonly treatmentService: TreatmentService) {}

  // ==================== QUERIES ====================

  /**
   * Query: Ottiene un trattamento per ID
   */
  @Query(() => Treatment, { name: 'treatment', nullable: true })
  async getTreatment(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Treatment | null> {
    return this.treatmentService.findById(id);
  }

  /**
   * Query: Ottiene il trattamento associato a un appuntamento
   */
  @Query(() => Treatment, { name: 'treatmentByAppointment', nullable: true })
  async getTreatmentByAppointment(
    @Args('appointmentId', { type: () => ID }) appointmentId: string,
  ): Promise<Treatment | null> {
    return this.treatmentService.findByAppointmentId(appointmentId);
  }

  /**
   * Query: Trattamenti in corso/completati per un operatore
   */
  @Query(() => [Treatment], { name: 'treatmentsByOperator' })
  async getTreatmentsByOperator(
    @Args('operatorId', { type: () => ID }) operatorId: string,
    @Args('date', { nullable: true }) date?: string,
  ): Promise<Treatment[]> {
    return this.treatmentService.getActiveByOperator(operatorId, date);
  }

  /**
   * Query: Trattamenti in attesa di chiusura da parte della segreteria
   */
  @Query(() => [Treatment], { name: 'treatmentsPendingClosure' })
  async getTreatmentsPendingClosure(): Promise<Treatment[]> {
    return this.treatmentService.getPendingForSecretary();
  }

  /**
   * Query: Trattamenti di un paziente
   */
  @Query(() => [Treatment], { name: 'treatmentsByPatient' })
  async getTreatmentsByPatient(
    @Args('patientId', { type: () => Int }) patientId: number,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('offset', { type: () => Int, nullable: true }) offset?: number,
  ): Promise<Treatment[]> {
    return this.treatmentService.getByPatient(patientId, limit, offset);
  }

  /**
   * Query: Trattamenti non fatturati al paziente
   */
  @Query(() => [Treatment], { name: 'treatmentsNotInvoicedToPatient' })
  async getTreatmentsNotInvoicedToPatient(
    @Args('dateFrom', { nullable: true }) dateFrom?: string,
    @Args('dateTo', { nullable: true }) dateTo?: string,
  ): Promise<Treatment[]> {
    return this.treatmentService.getNotInvoicedToPatient(dateFrom, dateTo);
  }

  /**
   * Query: Trattamenti non fatturati dall'operatore allo studio
   */
  @Query(() => [Treatment], { name: 'treatmentsNotInvoicedByOperator' })
  async getTreatmentsNotInvoicedByOperator(
    @Args('operatorId', { type: () => ID, nullable: true }) operatorId?: string,
    @Args('dateFrom', { nullable: true }) dateFrom?: string,
    @Args('dateTo', { nullable: true }) dateTo?: string,
  ): Promise<Treatment[]> {
    return this.treatmentService.getNotInvoicedByOperator(operatorId, dateFrom, dateTo);
  }

  // ==================== MUTATIONS ====================

  /**
   * Mutation: Crea un trattamento da un appuntamento (quando paziente arriva)
   */
  @Mutation(() => Treatment, { name: 'createTreatment' })
  async createTreatment(
    @Args('appointmentId', { type: () => ID }) appointmentId: string,
  ): Promise<Treatment> {
    return this.treatmentService.createFromAppointment(appointmentId);
  }

  /**
   * Mutation: Operatore completa il trattamento
   */
  @Mutation(() => Treatment, { name: 'completeTreatment' })
  async completeTreatment(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: CompleteTreatmentInput,
  ): Promise<Treatment> {
    return this.treatmentService.complete(id, input);
  }

  /**
   * Mutation: Segreteria chiude il trattamento
   */
  @Mutation(() => Treatment, { name: 'closeTreatment' })
  async closeTreatment(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: CloseTreatmentInput,
  ): Promise<Treatment> {
    return this.treatmentService.close(id, input);
  }

  /**
   * Mutation: Registra pagamento del paziente
   */
  @Mutation(() => Treatment, { name: 'recordTreatmentPayment' })
  async recordPayment(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: RecordPaymentInput,
  ): Promise<Treatment> {
    return this.treatmentService.recordPayment(id, input);
  }

  /**
   * Mutation: Marca trattamento come fatturato al paziente
   */
  @Mutation(() => Treatment, { name: 'markTreatmentInvoicedToPatient' })
  async markInvoicedToPatient(
    @Args('id', { type: () => ID }) id: string,
    @Args('invoiceNumber', { nullable: true }) invoiceNumber?: string,
  ): Promise<Treatment> {
    return this.treatmentService.markInvoicedToPatient(id, invoiceNumber);
  }

  /**
   * Mutation: Marca trattamento come fatturato dall'operatore allo studio
   */
  @Mutation(() => Treatment, { name: 'markTreatmentInvoicedByOperator' })
  async markInvoicedByOperator(
    @Args('id', { type: () => ID }) id: string,
    @Args('invoiceNumber', { nullable: true }) invoiceNumber?: string,
  ): Promise<Treatment> {
    return this.treatmentService.markInvoicedByOperator(id, invoiceNumber);
  }

  /**
   * Mutation: Aggiorna strumenti del trattamento
   */
  @Mutation(() => Treatment, { name: 'updateTreatmentInstruments' })
  async updateInstruments(
    @Args('id', { type: () => ID }) id: string,
    @Args('instruments', { type: () => [TreatmentInstrumentInput] }) instruments: TreatmentInstrumentInput[],
  ): Promise<Treatment> {
    return this.treatmentService.updateInstruments(id, instruments);
  }
}
