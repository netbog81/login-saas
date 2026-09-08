import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { TenantContextService } from '@curandis/tenant-datasource';

import { Treatment } from '../entities/treatment.entity';
import { TreatmentStatus } from '../entities/treatment-enums';
import { TreatmentBillingStatus } from '../entities/treatment-billing-status.enum';
import { TreatmentService as TreatmentServiceEntity } from '../entities/treatment-service.entity';
import { Operator } from '../entities/operator.entity';
import { OperatorMacroCategory } from '../entities/operator-macro-category.enum';
import { AvailabilityAppointment } from '../entities/availability-appointment.entity';
import { AppointmentType } from '../entities/appointment-type.enum';
import { TherapeuticPath } from '../entities/therapeutic-path.entity';
import { GeneralSettingsService } from '../../settings/services/general-settings.service';
import {
  PendingFeCollectionItem,
  PendingFeCollections,
} from '../dto/pending-fe-collection.output';

/** Chi sta guardando: deciso server-side dal resolver (ruoli Keycloak + AppUser). */
export interface PendingFeCaller {
  /** AppUser id del chiamante (null se non risolvibile). */
  appUserId: string | null;
  /** True per segreteria/admin: vede e incassa sempre tutto. */
  isSecretary: boolean;
}

interface PendingFeRawRow {
  treatmentId: string;
  startedAt: Date;
  status: TreatmentStatus;
  price: string | null;
  operatorId: string;
  operatorName: string | null;
  operatorSurname: string | null;
  operatorAppUserId: string | null;
  operatorMacroCategory: string | null;
  appointmentType: string | null;
  pathName: string | null;
}

/**
 * Sconto FE non incassati di un paziente (allarme nella cartella paziente).
 *
 * Perché serve: sui trattamenti `scontoFE` il pagamento resta tutto nel
 * clinico (vedi payment-source-duality) — accounting non emette nulla, quindi
 * nessuna fattura scaduta segnala l'incasso dimenticato. Qui li raccogliamo
 * per paziente, fisioterapia e palestra insieme.
 *
 * Perimetro (deciso 2026-08-27): TUTTI i trattamenti già iniziati, anche
 * quelli ancora in corso o non chiusi dalla segreteria. Restano fuori solo i
 * cancellati e i cestinati.
 */
@Injectable()
export class PendingFeCollectionsService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly settingsService: GeneralSettingsService,
  ) {}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  /**
   * Elenco degli sconto FE scoperti del paziente + permessi di incasso del
   * chiamante riga per riga.
   *
   * La visibilità NON dipende mai dall'impostazione: chiunque apra la cartella
   * vede tutti gli scoperti FE del paziente (serve a capire la situazione).
   * L'impostazione governa solo `canCollect`.
   */
  async listForPatient(
    patientId: string,
    caller: PendingFeCaller,
  ): Promise<PendingFeCollections> {
    const allowAnyOperatorCollect =
      await this.settingsService.isScontoFeCollectAnyOperatorEnabled();

    const rows = await this.dataSource
      .getRepository(Treatment)
      .createQueryBuilder('t')
      .leftJoin(Operator, 'op', 'op.id = t."operatorId"')
      .leftJoin(AvailabilityAppointment, 'a', 'a.id = t."appointmentId"')
      .leftJoin(TherapeuticPath, 'p', 'p.id = t."therapeuticPathId"')
      .where('t."patientId" = :patientId', { patientId })
      .andWhere('t."scontoFE" = true')
      .andWhere('t."isPaid" = false')
      .andWhere('t."deletedAt" IS NULL')
      .andWhere('t."billingStatus" <> :cancelled', {
        cancelled: TreatmentBillingStatus.CANCELLED,
      })
      .andWhere('t."startedAt" <= NOW()')
      .select('t.id', 'treatmentId')
      .addSelect('t."startedAt"', 'startedAt')
      .addSelect('t.status', 'status')
      .addSelect('t.price', 'price')
      .addSelect('t."operatorId"', 'operatorId')
      .addSelect('op.name', 'operatorName')
      .addSelect('op.surname', 'operatorSurname')
      .addSelect('op."app_user_id"', 'operatorAppUserId')
      .addSelect('op."macroCategory"', 'operatorMacroCategory')
      .addSelect('a."appointmentType"', 'appointmentType')
      .addSelect('p.name', 'pathName')
      .orderBy('t."startedAt"', 'DESC')
      .getRawMany<PendingFeRawRow>();

    if (rows.length === 0) {
      return {
        count: 0,
        totalAmount: 0,
        allowAnyOperatorCollect,
        callerIsSecretary: caller.isSecretary,
        items: [],
      };
    }

    const treatmentIds = rows.map((r) => r.treatmentId);
    const [lineTotals, descriptions] = await this.loadServiceLines(treatmentIds);

    // L'operatore del chiamante serve per il gate canCollectPayment: il
    // permesso di incassare è della PERSONA che incassa, non del trattamento.
    const callerOperator = caller.appUserId
      ? await this.dataSource
          .getRepository(Operator)
          .findOne({ where: { appUserId: caller.appUserId } })
      : null;

    const items: PendingFeCollectionItem[] = rows.map((row) => {
      const amount = this.resolveAmount(row.price, lineTotals.get(row.treatmentId));
      const { canCollect, reason } = this.evaluateCollectPermission(
        row,
        caller,
        callerOperator,
        allowAnyOperatorCollect,
      );

      return {
        treatmentId: row.treatmentId,
        startedAt: new Date(row.startedAt).toISOString(),
        status: row.status,
        operatorId: row.operatorId,
        operatorName: [row.operatorName, row.operatorSurname]
          .filter(Boolean)
          .join(' ')
          .trim() || 'Operatore',
        operatorAppUserId: row.operatorAppUserId,
        isGym:
          row.appointmentType === AppointmentType.GYM ||
          row.operatorMacroCategory === OperatorMacroCategory.GYM_INSTRUCTOR,
        amount,
        servicesDescription: descriptions.get(row.treatmentId) ?? null,
        therapeuticPathName: row.pathName,
        canCollect,
        cannotCollectReason: canCollect ? null : reason,
      };
    });

    return {
      count: items.length,
      totalAmount: this.round(items.reduce((s, i) => s + i.amount, 0)),
      allowAnyOperatorCollect,
      callerIsSecretary: caller.isSecretary,
      items,
    };
  }

  /**
   * Verifica di autorizzazione riusata da TreatmentService al momento
   * dell'incasso vero e proprio: la UI nasconde il pulsante, il backend
   * rifiuta comunque (la UI non è una guardia).
   *
   * Ritorna null se l'incasso è consentito, altrimenti il motivo del rifiuto.
   */
  async denyReasonForCollect(
    treatment: Pick<Treatment, 'operatorId'>,
    caller: PendingFeCaller,
  ): Promise<string | null> {
    if (caller.isSecretary) return null;

    const operatorRepo = this.dataSource.getRepository(Operator);
    const [callerOperator, treatmentOperator] = await Promise.all([
      caller.appUserId
        ? operatorRepo.findOne({ where: { appUserId: caller.appUserId } })
        : Promise.resolve(null),
      operatorRepo.findOne({ where: { id: treatment.operatorId } }),
    ]);

    const allowAnyOperatorCollect =
      await this.settingsService.isScontoFeCollectAnyOperatorEnabled();

    const { canCollect, reason } = this.evaluateCollectPermission(
      {
        operatorAppUserId: treatmentOperator?.appUserId ?? null,
        operatorName: treatmentOperator?.name ?? null,
        operatorSurname: treatmentOperator?.surname ?? null,
      },
      caller,
      callerOperator,
      allowAnyOperatorCollect,
    );

    return canCollect ? null : reason;
  }

  /**
   * Regola unica di autorizzazione all'incasso sconto FE:
   *  - segreteria/admin: sempre;
   *  - operatore senza scheda Operator o con canCollectPayment=false: mai
   *    (il flag per-operatore resta il gate principale);
   *  - operatore sul PROPRIO trattamento: sempre;
   *  - operatore sul trattamento di un collega: solo con l'impostazione
   *    "permetti a tutti gli operatori di incassare sconto FE" attiva.
   */
  private evaluateCollectPermission(
    row: Pick<PendingFeRawRow, 'operatorAppUserId' | 'operatorName' | 'operatorSurname'>,
    caller: PendingFeCaller,
    callerOperator: Operator | null,
    allowAnyOperatorCollect: boolean,
  ): { canCollect: boolean; reason: string | null } {
    if (caller.isSecretary) {
      return { canCollect: true, reason: null };
    }
    if (!caller.appUserId || !callerOperator) {
      return {
        canCollect: false,
        reason: 'Il tuo utente non è collegato a nessun operatore: non puoi registrare incassi.',
      };
    }
    if (callerOperator.canCollectPayment === false) {
      return {
        canCollect: false,
        reason: 'Non sei abilitato a registrare incassi (canCollectPayment disattivo sulla tua scheda operatore).',
      };
    }
    const isOwn =
      !!row.operatorAppUserId && row.operatorAppUserId === caller.appUserId;
    if (isOwn) {
      return { canCollect: true, reason: null };
    }
    if (allowAnyOperatorCollect) {
      return { canCollect: true, reason: null };
    }
    const owner = [row.operatorName, row.operatorSurname]
      .filter(Boolean)
      .join(' ')
      .trim();
    return {
      canCollect: false,
      reason:
        `Trattamento di ${owner || 'un altro operatore'}: l'incasso degli sconto FE altrui ` +
        'non è abilitato (Configurazioni → Incassi sconto FE).',
    };
  }

  /**
   * Somma righe servizio + descrizione dei servizi, in un'unica query per
   * tutti i trattamenti dell'elenco (niente N+1).
   */
  private async loadServiceLines(
    treatmentIds: string[],
  ): Promise<[Map<string, number>, Map<string, string>]> {
    const lines = await this.dataSource
      .getRepository(TreatmentServiceEntity)
      .find({
        where: { treatmentId: In(treatmentIds) },
        relations: ['service'],
        order: { orderPosition: 'ASC' },
      });

    const totals = new Map<string, number>();
    const names = new Map<string, string[]>();
    for (const line of lines) {
      totals.set(
        line.treatmentId,
        this.round((totals.get(line.treatmentId) ?? 0) + Number(line.price ?? 0)),
      );
      const label = line.service?.name?.trim();
      if (label) {
        const list = names.get(line.treatmentId) ?? [];
        list.push(label);
        names.set(line.treatmentId, list);
      }
    }

    const descriptions = new Map<string, string>();
    for (const [treatmentId, list] of names) {
      descriptions.set(treatmentId, list.join(', '));
    }
    return [totals, descriptions];
  }

  /**
   * Importo da incassare. `treatment.price` è il totale dovuto, ma resta 0
   * finché il trattamento non viene completato: per quelli ancora in corso si
   * ricade sulla somma delle righe servizio.
   */
  private resolveAmount(price: string | null, linesTotal: number | undefined): number {
    const treatmentPrice = Number(price ?? 0);
    if (treatmentPrice > 0) return this.round(treatmentPrice);
    return this.round(linesTotal ?? 0);
  }

  private round(n: number): number {
    return Math.round((Number(n) || 0) * 100) / 100;
  }
}
