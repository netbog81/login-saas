import {
  Resolver,
  Query,
  Mutation,
  Args,
  ID,
  Float,
  ResolveField,
  Parent,
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { VoucherFe } from '../entities/voucher-fe.entity';
import { VoucherFeService } from '../services/voucher-fe.service';
import { BillingWriteGuard } from '../guards/billing-write.guard';
import { CurrentUser, CurrentUserContext } from '../../users/decorators/current-user.decorator';
import { AppUserService } from '../../users/services/app-user.service';
import { PatientModel } from '../../../patients/models/patient.model';

/**
 * Resolver Voucher FE (PARTE 4.3). Gestione 100% clinica dei voucher usati
 * per i trattamenti con sconto FE. Le mutation di emissione richiedono i ruoli
 * billing (segreteria/admin), come le altre azioni economiche.
 */
@Resolver(() => VoucherFe)
export class VoucherFeResolver {
  constructor(
    private readonly voucherFeService: VoucherFeService,
    private readonly appUserService: AppUserService,
  ) {}

  private async resolveAppUserId(
    user: CurrentUserContext | undefined,
  ): Promise<string | undefined> {
    if (!user?.userId) return undefined;
    const appUser = await this.appUserService.findByKeycloakId(user.userId);
    return appUser?.id;
  }

  /** Voucher FE utilizzabili da un paziente (attivi, residuo>0, non scaduti). */
  @Query(() => [VoucherFe], { name: 'usableVouchersFe' })
  usableVouchersFe(
    @Args('patientId', { type: () => ID }) patientId: string,
  ): Promise<VoucherFe[]> {
    return this.voucherFeService.findUsableForPatient(patientId);
  }

  /** Tutti i voucher FE di un paziente (storico incluso lo stato). */
  @Query(() => [VoucherFe], { name: 'vouchersFeByPatient' })
  vouchersFeByPatient(
    @Args('patientId', { type: () => ID }) patientId: string,
  ): Promise<VoucherFe[]> {
    return this.voucherFeService.findByPatient(patientId);
  }

  /** Tutti i voucher FE del tenant (Statistiche), filtrabili per data emissione. */
  @Query(() => [VoucherFe], { name: 'allVouchersFe' })
  allVouchersFe(
    @Args('from', { type: () => String, nullable: true }) from?: string,
    @Args('to', { type: () => String, nullable: true }) to?: string,
  ): Promise<VoucherFe[]> {
    return this.voucherFeService.findAll(from, to);
  }

  /**
   * ResolveField: shell `Patient { id }` da `patientId`. I campi del subject
   * (nome/cognome) sono risolti dal PatientResolver via RegistrySubjectLoader.
   */
  @ResolveField(() => PatientModel, { nullable: true })
  patient(@Parent() voucher: VoucherFe): PatientModel | null {
    if (!voucher.patientId) return null;
    return { id: voucher.patientId } as PatientModel;
  }

  @Mutation(() => VoucherFe, { name: 'issueVoucherFe' })
  @UseGuards(BillingWriteGuard)
  async issueVoucherFe(
    @Args('patientId', { type: () => ID }) patientId: string,
    @Args('initialAmount', { type: () => Float }) initialAmount: number,
    @Args('expiryDate', { type: () => String, nullable: true }) expiryDate?: string,
    @Args('notes', { type: () => String, nullable: true }) notes?: string,
    @CurrentUser() user?: CurrentUserContext,
  ): Promise<VoucherFe> {
    const createdByUserId = await this.resolveAppUserId(user);
    return this.voucherFeService.issue(
      { patientId, initialAmount, expiryDate, notes },
      createdByUserId,
    );
  }

  /** Modifica l'importo (iniziale se intatto, residuo se già consumato). */
  @Mutation(() => VoucherFe, { name: 'updateVoucherFeAmount' })
  @UseGuards(BillingWriteGuard)
  async updateVoucherFeAmount(
    @Args('voucherFeId', { type: () => ID }) voucherFeId: string,
    @Args('amount', { type: () => Float }) amount: number,
    @CurrentUser() user?: CurrentUserContext,
  ): Promise<VoucherFe> {
    const createdByUserId = await this.resolveAppUserId(user);
    return this.voucherFeService.updateAmount(voucherFeId, amount, createdByUserId);
  }

  /** Sospende (reversibile) un voucher FE. */
  @Mutation(() => VoucherFe, { name: 'suspendVoucherFe' })
  @UseGuards(BillingWriteGuard)
  suspendVoucherFe(
    @Args('voucherFeId', { type: () => ID }) voucherFeId: string,
  ): Promise<VoucherFe> {
    return this.voucherFeService.suspend(voucherFeId);
  }

  /** Riattiva un voucher FE sospeso. */
  @Mutation(() => VoucherFe, { name: 'reactivateVoucherFe' })
  @UseGuards(BillingWriteGuard)
  reactivateVoucherFe(
    @Args('voucherFeId', { type: () => ID }) voucherFeId: string,
  ): Promise<VoucherFe> {
    return this.voucherFeService.reactivate(voucherFeId);
  }

  /** Annulla definitivamente un voucher FE. */
  @Mutation(() => VoucherFe, { name: 'cancelVoucherFe' })
  @UseGuards(BillingWriteGuard)
  cancelVoucherFe(
    @Args('voucherFeId', { type: () => ID }) voucherFeId: string,
  ): Promise<VoucherFe> {
    return this.voucherFeService.cancel(voucherFeId);
  }
}
