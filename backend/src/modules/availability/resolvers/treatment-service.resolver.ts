import { Resolver, ResolveField, Parent } from '@nestjs/graphql';
import { TreatmentService } from '../entities/treatment-service.entity';
import { Treatment } from '../entities/treatment.entity';
import { Operator } from '../entities/operator.entity';
import { Service } from '../entities/service.entity';
import { TreatmentInstrument } from '../entities/treatment-instrument.entity';
import { ServiceInvoicePrefixService } from '../services/service-invoice-prefix.service';
import { TenantContextService } from '@curandis/tenant-datasource';

/**
 * Resolver per campi virtuali di TreatmentService.
 *
 * In particolare calcola `invoiceLineDescriptionAuto`, la descrizione
 * auto-generata della riga fattura composta con:
 *   {prefix categoria operatore} {data} — {servizio[ (strumenti)]} — {operatore[, albo]}
 */
@Resolver(() => TreatmentService)
export class TreatmentServiceResolver {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly prefixService: ServiceInvoicePrefixService,
  ){}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  private get treatmentRepo() { return this.dataSource.getRepository(Treatment); }

  private get operatorRepo() { return this.dataSource.getRepository(Operator); }

  private get serviceRepo() { return this.dataSource.getRepository(Service); }

  private get treatmentInstrumentRepo() { return this.dataSource.getRepository(TreatmentInstrument); }

  @ResolveField(() => String, { nullable: true })
  async invoiceLineDescriptionAuto(
    @Parent() ts: TreatmentService,
  ): Promise<string | null> {
    // Carica treatment, operator, service, strumenti in parallelo
    const treatment = await this.treatmentRepo.findOne({
      where: { id: ts.treatmentId },
      relations: ['appointment'],
    });
    if (!treatment) return null;

    const [operator, service, instruments] = await Promise.all([
      this.operatorRepo.findOne({ where: { id: treatment.operatorId } }),
      ts.serviceId
        ? this.serviceRepo.findOne({ where: { id: ts.serviceId } })
        : Promise.resolve(null),
      this.treatmentInstrumentRepo.find({
        where: { treatmentId: ts.treatmentId },
        relations: ['instrument'],
      }),
    ]);

    if (!operator || !service) return null;

    const prefix = await this.prefixService.getPrefixOrDefault(operator.macroCategory);

    const operatorFullName = [operator.name, operator.surname].filter(Boolean).join(' ').trim();
    const instrumentNames = (instruments || [])
      .filter(i => i.wasUsed && i.instrument?.name)
      .map(i => i.instrument.name);

    const apptDate = treatment.appointment?.appointmentDate;
    const apptDateStr = apptDate instanceof Date
      ? apptDate.toISOString().slice(0, 10)
      : (apptDate as unknown as string) || null;

    return this.prefixService.composeDescription({
      prefix,
      appointmentDate: apptDateStr,
      serviceName: service.name,
      instrumentNames,
      operatorFullName,
      professionalRegistration: operator.professionalRegistration,
    });
  }
}
