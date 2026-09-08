import { Injectable, Logger } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import Decimal from 'decimal.js';

import { Treatment } from '../../availability/entities/treatment.entity';
import { TreatmentService as TreatmentServiceEntity } from '../../availability/entities/treatment-service.entity';
import { TreatmentInvoiceLine } from '../../availability/entities/treatment-invoice-line.entity';
import { Operator } from '../../availability/entities/operator.entity';
import { Service as ServiceEntity } from '../../availability/entities/service.entity';
import { AvailabilityAppointment } from '../../availability/entities/availability-appointment.entity';
import { TherapeuticPath } from '../../availability/entities/therapeutic-path.entity';
import { AppUser } from '../../users/entities/app-user.entity';
import { TreatmentInstrument } from '../../availability/entities/treatment-instrument.entity';
import { ServiceInvoicePrefix } from '../../availability/entities/service-invoice-prefix.entity';
import { InvoiceLineSettings } from '../../availability/entities/invoice-line-settings.entity';
import { ServiceInvoicePrefixService } from '../../availability/services/service-invoice-prefix.service';
import { OperatorMacroCategory } from '../../availability/entities/operator-macro-category.enum';
import {
  TreatmentClosedPayload,
  TreatmentLine,
  TreatmentLineCustom,
  TreatmentLineService,
  TreatmentPayment,
} from '../clinical-events.types';

/**
 * Mapper Treatment → payload `treatment.closed.<tenant>`.
 *
 * Esegue un batch lookup `AppUser.id → AppUser.keycloakId` per evitare N+1
 * sui campi `*UserId` (closedByUserId, executedByUserId per ogni line,
 * collectedByUserId, createdByUserId).
 *
 * Tutti i numeric escono come stringa "N.NN" (decimal.js per evitare bug
 * floating-point sui totali).
 *
 * Uso tipico:
 *   const payload = await mapper.mapTreatmentClosed(treatmentId, tx, {
 *     siteIdOverride?: string,    // se non ancora cablato in Treatment
 *     requestImmediateInvoice: false,
 *   });
 *
 * Importante (vedi spec §22 + decisioni Step 7, rivisto 2026-07-15):
 *  - L'esecutore di una riga SERVICE è l'OPERATORE che l'ha eseguita:
 *    `ts.executorOperator` (override esplicito "Eseguito da") altrimenti
 *    l'operatore del trattamento. Il payload porta sia
 *    `executedByOperatorId`/`executedByOperatorName` (id clinico, chiave
 *    per i conteggi accounting) sia `executedByUserId` (sub Keycloak
 *    dell'operatore, null se non collegato) — NON omettere i campi null.
 *    La colonna legacy `ts.executedByOperatorId` (app_users.id) NON viene
 *    più letta: era inquinata dall'utente loggato (segreteria).
 *  - quantity SERVICE = "1" hardcoded per MVP (modello clinico non
 *    supporta qty>1 per TreatmentService).
 *  - quantity CUSTOM = "1" hardcoded (TreatmentInvoiceLine non ha qty).
 *  - totalAmount = SUM(treatmentServices.price * 1) + SUM(invoiceLines.amount)
 *    ricalcolato server-side, NON `treatment.price` cached.
 */
@Injectable()
export class TreatmentEventMapper {
  private readonly logger = new Logger(TreatmentEventMapper.name);

  /**
   * Costruisce il payload `treatment.closed` (e `treatment.amended`, che
   * usa lo stesso shape + revision/amendmentReason).
   */
  async mapTreatmentClosed(
    treatmentId: string,
    manager: EntityManager,
    opts: {
      requestImmediateInvoice: boolean;
    },
  ): Promise<TreatmentClosedPayload> {
    // Carico tutto in una sola findOne con relations: niente N+1.
    const treatment = await manager.findOne(Treatment, {
      where: { id: treatmentId },
      relations: {
        appointment: true,
        operator: { category: true },
        therapeuticPath: true,
        treatmentServices: {
          service: { subcategory: true },
          executorOperator: true,
        },
        invoiceLines: true,
      },
    });
    if (!treatment) {
      throw new Error(
        `TreatmentEventMapper: treatment "${treatmentId}" non trovato (è stato cancellato dopo il commit?).`,
      );
    }

    // Site, executionDate, closedAt
    if (!treatment.siteId) {
      throw new Error(
        `TreatmentEventMapper: treatment "${treatmentId}" senza siteId (migration Step 1 non applicata?).`,
      );
    }
    if (!treatment.patientId) {
      throw new Error(
        `TreatmentEventMapper: treatment "${treatmentId}" senza patientId. Impossibile costruire payload (beneficiarySubjectId manca).`,
      );
    }
    if (!treatment.closedAt) {
      throw new Error(
        `TreatmentEventMapper: treatment "${treatmentId}" senza closedAt. Hook chiamato prima della transition CLOSED?`,
      );
    }

    const executionDate = this.formatDateOnly(
      this.resolveExecutionDate(treatment, treatment.appointment),
    );

    // Batch lookup AppUser.id → keycloakId per tutti i *UserId del payload.
    const appUserIds = this.collectAppUserIds(treatment);
    const subMap = await this.batchLookupKeycloakSubs(manager, appUserIds);

    // Lines: prima SERVICE poi CUSTOM (ordering deterministico).
    const services = treatment.treatmentServices ?? [];
    const customLines = treatment.invoiceLines ?? [];

    // Dati per la descrizione auto-generata delle righe senza override
    // manuale: template/prefissi per categoria + strumenti usati. Stessa
    // logica di invoiceLineDescriptionAuto (resolver), così ciò che
    // l'operatore vede in anteprima è ciò che arriva in fattura.
    const prefixConfigs = await manager.getRepository(ServiceInvoicePrefix).find();
    const configByCategory = new Map(prefixConfigs.map(p => [p.macroCategory, p]));
    // Toggle "sottocategorie operatori" (tabella settings, una riga per
    // tenant): se attivo, prefisso/template arrivano dalla categoria
    // dell'operatore invece che dalla macro-categoria.
    const lineSettings = await manager.getRepository(InvoiceLineSettings).find({ take: 1 });
    const useOperatorCategories = lineSettings[0]?.useOperatorCategories ?? false;
    const usedInstruments = await manager.find(TreatmentInstrument, {
      where: { treatmentId: treatment.id },
      relations: { instrument: true },
    });
    const instrumentNames = usedInstruments
      .filter(i => i.wasUsed && i.instrument?.name)
      .map(i => i.instrument.name)
      .join(', ');

    const serviceLines: TreatmentLineService[] = services.map((ts) =>
      this.buildServiceLine(
        ts,
        treatment.operator,
        treatment.therapeuticPath,
        subMap,
        executionDate,
        this.buildAutoDescription(ts, treatment.operator, executionDate, configByCategory, instrumentNames, useOperatorCategories),
      ),
    );
    const customLinesPayload: TreatmentLineCustom[] = customLines.map((il) =>
      this.buildCustomLine(il, subMap),
    );
    const lines: TreatmentLine[] = [...serviceLines, ...customLinesPayload];

    // Total amount: ricalcolato dalle linee (decimal.js per niente float bug).
    const totalAmount = this.computeTotalAmount(serviceLines, customLinesPayload);

    return {
      treatmentId: treatment.id,
      siteId: treatment.siteId,
      beneficiarySubjectId: treatment.patientId,
      executionDate,
      closedAt: treatment.closedAt.toISOString(),
      closedByUserId: this.resolveSub(subMap, treatment.closedByUserId),
      forcedClosure: treatment.forcedClosure,
      lines,
      totalAmount,
      payment: this.buildPayment(treatment, subMap),
      requestImmediateInvoice: opts.requestImmediateInvoice,
      notes: {
        secretary: treatment.secretaryNotes ?? null,
        operator: treatment.operatorNotes ?? null,
        patient: treatment.patientNotes ?? null,
      },
    };
  }

  /**
   * Costruisce il payload `treatment.amended.<tenant>`. Stesso shape di
   * `treatment.closed` + `revision` (intero monotono crescente) +
   * `amendmentReason`.
   */
  async mapTreatmentAmended(
    treatmentId: string,
    manager: EntityManager,
    opts: { revision: number; amendmentReason: string },
  ): Promise<TreatmentClosedPayload & { revision: number; amendmentReason: string }> {
    const closedPayload = await this.mapTreatmentClosed(treatmentId, manager, {
      requestImmediateInvoice: false,
    });
    return {
      ...closedPayload,
      revision: opts.revision,
      amendmentReason: opts.amendmentReason,
    };
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  /**
   * Descrizione auto-generata per una riga SERVICE senza override manuale:
   * template per macro-categoria (se configurato) o composizione legacy.
   */
  private buildAutoDescription(
    ts: TreatmentServiceEntity,
    operator: Operator | undefined,
    executionDate: string,
    configByCategory: Map<OperatorMacroCategory, ServiceInvoicePrefix>,
    instrumentNames: string,
    useOperatorCategories: boolean,
  ): string {
    const service: ServiceEntity | undefined = ts.service;
    const category = service?.macroCategory ?? operator?.macroCategory ?? OperatorMacroCategory.OTHER;
    const saved = configByCategory.get(category);
    // Stessa scelta di config del resolver invoiceLineDescriptionAuto:
    // ciò che l'operatore vede in anteprima è ciò che arriva in fattura.
    const config = ServiceInvoicePrefixService.resolveConfig({
      useOperatorCategories,
      operatorCategory: operator?.category ?? null,
      macroCategory: category,
      macroSaved: saved ?? null,
    });
    const prefix = config.prefix;
    const operatorFullName = [operator?.name, operator?.surname].filter(Boolean).join(' ').trim();

    return ServiceInvoicePrefixService.composeAuto(
      config,
      {
        prefisso: prefix,
        data: ServiceInvoicePrefixService.formatDateItalian(executionDate),
        codiceServizio: service?.serviceCode ?? '',
        nomeServizio: service?.name ?? '',
        descrizioneServizio: service?.description ?? '',
        descrizioneFatturaSottocategoria: service?.subcategory?.invoiceLineDescription ?? '',
        operatore: operatorFullName,
        albo: operator?.professionalRegistration ?? '',
        descrizioneFatturaCategoria: operator?.category?.invoiceLineDescription ?? '',
        strumenti: instrumentNames,
      },
    );
  }

  private buildServiceLine(
    ts: TreatmentServiceEntity,
    operator: Operator | undefined,
    therapeuticPath: TherapeuticPath | undefined,
    subMap: Map<string, string | null>,
    executionDate: string,
    autoDescription?: string,
  ): TreatmentLineService {
    const service: ServiceEntity | undefined = ts.service;

    // Esecutore della riga: override esplicito "Eseguito da"
    // (ts.executorOperator) altrimenti l'operatore del trattamento.
    // executedByUserId = sub Keycloak dell'OPERATORE esecutore (null se
    // l'operatore non è collegato a un utente — mappare esplicitamente
    // null, NON undefined). La colonna legacy ts.executedByOperatorId
    // (app_users.id) non viene più letta: era valorizzata con l'utente
    // loggato e attribuiva i compensi a segreteria/admin.
    const executor: Operator | undefined = ts.executorOperator ?? operator;
    const executedByUserId = this.resolveSub(subMap, executor?.appUserId ?? null);
    const executorName =
      [executor?.name, executor?.surname].filter(Boolean).join(' ').trim() || null;

    // invoiceLineDescription: NEVER null (lato accounting `itemDescription`
    // è NOT NULL → INSERT fallisce). Senza override manuale usa la
    // descrizione auto-generata (template per categoria / composizione
    // legacy), la stessa mostrata in anteprima dal resolver
    // invoiceLineDescriptionAuto. Ultimo fallback: pattern storico.
    const invoiceLineDescription =
      ts.invoiceLineDescription && ts.invoiceLineDescription.trim().length > 0
        ? ts.invoiceLineDescription
        : (autoDescription?.trim()
            || `${service?.name ?? 'Prestazione'} del ${executionDate}`);

    return {
      lineId: ts.id,
      lineType: 'SERVICE',
      serviceId: ts.serviceId,
      serviceCode: service?.serviceCode ?? this.fallbackServiceCode(ts.serviceId),
      executedByUserId,
      executedByOperatorId: executor?.id ?? null,
      executedByOperatorName: executorName,
      professionalRegistration:
        executor?.professionalRegistration ?? operator?.professionalRegistration ?? null,
      macroCategory: service?.macroCategory ?? operator?.macroCategory ?? null,
      quantity: '1', // hardcoded MVP: TreatmentService non supporta qty>1
      duration: ts.duration ?? null,
      finalUnitPrice: this.toDecimalString(ts.price ?? 0),
      isCustomPrice: ts.isCustomPrice,
      invoiceLineDescription,
      diagnosis: therapeuticPath?.diagnosis ?? null,
      icdCode: therapeuticPath?.icdCode ?? null,
      externalDoctorName: therapeuticPath?.externalDoctorName ?? null,
      externalPrescriptionRef: therapeuticPath?.externalPrescriptionRef ?? null,
    };
  }

  private buildCustomLine(
    il: TreatmentInvoiceLine,
    subMap: Map<string, string | null>,
  ): TreatmentLineCustom {
    return {
      lineId: il.id,
      lineType: 'CUSTOM',
      description: il.description,
      amount: this.toDecimalString(il.amount),
      quantity: '1', // hardcoded MVP
      createdByUserId: this.resolveSub(subMap, il.createdBy ?? null),
    };
  }

  private buildPayment(
    treatment: Treatment,
    subMap: Map<string, string | null>,
  ): TreatmentPayment | undefined {
    // 2026-09-04 — Un incasso PARZIALE non rende pagato il trattamento, ma
    // deve comunque arrivare in contabilità: sono le righe di tender a dire
    // che c'è un voucher di anticipo da scalare, e senza di esse il credito
    // non calerebbe mai e il residuo verrebbe fatturato per intero.
    const partialLines = (treatment.paymentTenderLines ?? []).filter(
      (l) => l.kind !== 'voucher_fe',
    );
    if (!treatment.isPaid && partialLines.length === 0) {
      // payment opzionale: se non c'è pagamento registrato, omettiamo
      // l'oggetto. Accounting genera comunque billable PENDING.
      return undefined;
    }
    const partialAmount = partialLines.reduce(
      (acc, l) => acc + (Number(l.amount) || 0),
      0,
    );
    return {
      isPaid: treatment.isPaid,
      paidAt: treatment.paidAt ? treatment.paidAt.toISOString() : null,
      paymentMethod: treatment.paymentMethod ?? null,
      // Pagato: il totale del trattamento. Parziale: solo la quota coperta.
      amount: treatment.isPaid
        ? this.toDecimalString(treatment.price ?? 0)
        : partialAmount.toFixed(2),
      collectedByUserId: this.resolveSub(subMap, treatment.collectedBy ?? null),
      // 2026-09-03 — Come è composto l'incasso, non solo con che metodo.
      // Senza queste righe la contabilità non sa che c'è un buono da scalare
      // quando l'incasso è stato registrato PRIMA dell'invio a fatturazione
      // (in quel caso `treatment.payment-recorded` non parte: il pagamento
      // viaggia solo qui dentro). I buoni FE restano fuori: sono interni al
      // clinico e la contabilità non li conosce.
      tenderLines: (treatment.paymentTenderLines ?? [])
        .filter((l) => l.kind !== 'voucher_fe')
        .map((l) => ({
          kind: l.kind === 'voucher' ? ('voucher' as const) : ('method' as const),
          paymentMethodId: l.kind === 'method' ? l.paymentMethodId ?? null : null,
          voucherId: l.kind === 'voucher' ? l.voucherId ?? null : null,
          amount: l.amount,
        })),
    };
  }

  /**
   * Raccoglie tutti gli AppUser.id referenziati nel treatment per il
   * batch lookup. Ritorna array senza null/undefined/duplicati.
   */
  private collectAppUserIds(treatment: Treatment): string[] {
    const ids = new Set<string>();
    if (treatment.closedByUserId) ids.add(treatment.closedByUserId);
    if (treatment.collectedBy) ids.add(treatment.collectedBy);
    if (treatment.operator?.appUserId) ids.add(treatment.operator.appUserId);
    for (const ts of treatment.treatmentServices ?? []) {
      // Esecutore esplicito della riga (operators.appUserId, NON la
      // colonna legacy executedByOperatorId che era inquinata dall'attore).
      if (ts.executorOperator?.appUserId) ids.add(ts.executorOperator.appUserId);
    }
    for (const il of treatment.invoiceLines ?? []) {
      if (il.createdBy) ids.add(il.createdBy);
    }
    return Array.from(ids);
  }

  /**
   * Batch SELECT id, keycloakId FROM app_users WHERE id IN (...). Ritorna
   * Map<appUserId, keycloakId|null>. Una sola query per request.
   */
  private async batchLookupKeycloakSubs(
    manager: EntityManager,
    appUserIds: string[],
  ): Promise<Map<string, string | null>> {
    const map = new Map<string, string | null>();
    if (appUserIds.length === 0) return map;

    const rows = await manager.find(AppUser, {
      where: { id: In(appUserIds) },
      select: { id: true, keycloakId: true },
    });
    for (const u of rows) {
      map.set(u.id, u.keycloakId ?? null);
    }
    // App users non trovati (orphan FK): registriamoli come null per
    // distinguerli dal "appUserId mai cercato".
    for (const id of appUserIds) {
      if (!map.has(id)) map.set(id, null);
    }
    return map;
  }

  /**
   * Risolve un appUserId locale al keycloakSub. Ritorna null se:
   *  - input è null/undefined
   *  - app user non trovato
   *  - app user trovato ma senza keycloakId (operator orfano dopo
   *    hard-delete; vedi Step 1 backfill notes)
   */
  private resolveSub(
    map: Map<string, string | null>,
    appUserId: string | null | undefined,
  ): string | null {
    if (!appUserId) return null;
    return map.get(appUserId) ?? null;
  }

  /**
   * Determina la data di esecuzione del treatment.
   *
   * Chain (decisione Marco): startedAt → appointmentDate → closedAt.
   *
   * Razionale: `startedAt` è la data EFFETTIVA in cui il paziente è
   * arrivato e il trattamento è iniziato; `appointmentDate` è solo la
   * data PROGRAMMATA (può differire se il paziente sposta last-minute,
   * arriva in ritardo, fa recupero). La fattura riflette la prestazione
   * realmente erogata.
   *
   * `startedAt` è NOT NULL nel DB con default `now()` all'INSERT, quindi
   * il primo branch dovrebbe sempre matchare. Gli altri fallback restano
   * difensivi per casi edge (treatment salvato fuori dal flusso standard).
   */
  private resolveExecutionDate(
    treatment: Treatment,
    appointment: AvailabilityAppointment | undefined,
  ): Date {
    if (treatment.startedAt) {
      return new Date(treatment.startedAt);
    }
    if (appointment?.appointmentDate) {
      return new Date(appointment.appointmentDate);
    }
    this.logger.warn(
      `Treatment ${treatment.id} senza startedAt né appointmentDate: uso closedAt come fallback executionDate`,
    );
    return treatment.closedAt!;
  }

  private formatDateOnly(d: Date): string {
    // YYYY-MM-DD in UTC (consistente con DATE column Postgres che è
    // timezone-naive). Evita off-by-one in fasce orarie estreme.
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private toDecimalString(v: number | string): string {
    return new Decimal(v).toFixed(2);
  }

  private computeTotalAmount(
    services: TreatmentLineService[],
    customs: TreatmentLineCustom[],
  ): string {
    let total = new Decimal(0);
    for (const s of services) {
      total = total.plus(new Decimal(s.finalUnitPrice).mul(new Decimal(s.quantity)));
    }
    for (const c of customs) {
      total = total.plus(new Decimal(c.amount).mul(new Decimal(c.quantity)));
    }
    return total.toFixed(2);
  }

  /**
   * Fallback se Service.serviceCode è mancante (non dovrebbe mai succedere
   * dopo Step 1 — la migration ha popolato `TMP-<id8>` per tutti — ma
   * difendiamo dal caso edge: schema non ancora migrato, oppure servizio
   * creato fuori dal flusso UI standard).
   */
  private fallbackServiceCode(serviceId: string): string {
    this.logger.warn(
      `Service ${serviceId} senza serviceCode: uso fallback TMP-<id8>. Sistemare via UI Service.`,
    );
    return `TMP-${serviceId.substring(0, 8)}`;
  }
}
