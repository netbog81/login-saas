import { Injectable } from '@nestjs/common';
import { EntityTarget, ObjectLiteral } from 'typeorm';
import { TenantContextService } from '@curandis/tenant-datasource';

import { AvailabilityAppointment } from '../../modules/availability/entities/availability-appointment.entity';
import { Appointment } from '../../entities/appointment.entity';
import { Treatment } from '../../modules/availability/entities/treatment.entity';
import { TherapeuticPath } from '../../modules/availability/entities/therapeutic-path.entity';
import { PatientEvaluation } from '../../modules/availability/entities/patient-evaluation.entity';
import { PatientAnamnesis } from '../../modules/availability/entities/patient-anamnesis.entity';
import { WaitingListEntry } from '../../modules/availability/entities/waiting-list-entry.entity';
import { VoucherFe } from '../../modules/availability/entities/voucher-fe.entity';
import { ClinicalAttendanceLog } from '../entities/clinical-attendance-log.entity';
import { AppointmentLog } from '../../modules/availability/entities/appointment-log.entity';
import { WhatsappMessageLog } from '../../modules/whatsapp/log/entities/whatsapp-message-log.entity';

import {
  DataSummaryEntry,
  SubjectDataSummary,
} from '../dto/subject-data-summary.dto';

/** Modulo sorgente: costante per tutti i conteggi del clinico. */
const SOURCE_MODULE = 'clinical';

/**
 * Definizione di un conteggio "semplice": una entity con una colonna che
 * contiene direttamente il subjectId del registry.
 */
interface SimpleCountSpec {
  referenceType: string;
  entity: EntityTarget<ObjectLiteral>;
  /** Nome della PROPRIETÀ TypeORM che contiene il subjectId (non il nome colonna DB). */
  property: string;
}

/**
 * SubjectDataSummaryService — conta, per un subject del registry, quante righe
 * di dati clinici lo referenziano. Read-only. Consumato S2S dal registry per
 * decidere se un paziente può essere hard-deleted.
 *
 * Isolamento tenant: il DataSource è quello del tenant corrente (DB-per-tenant,
 * risolto dal middleware auth-core in AsyncLocalStorage). Non serve un filtro
 * per organizationId: l'intero database è già scoped al tenant e queste entity
 * non hanno una colonna org (identico pattern a ClinicalAttendanceService).
 *
 * Conteggi: si contano SOLO le righe "vive" (non soft-deleted). Il QueryBuilder
 * di TypeORM applica automaticamente `deletedAt IS NULL` sulle entity con
 * DeleteDateColumn (AvailabilityAppointment, Treatment, TherapeuticPath,
 * PatientEvaluation). Le righe nel cestino (soft-deleted) verranno purgate a
 * parte e non contano come "dati che bloccano la cancellazione".
 *
 * NOTA appointment: "appointment" somma DUE sorgenti — la entity corrente
 * `AvailabilityAppointment` (availability_appointments.patientId) e la entity
 * legacy `Appointment` (appointments.patientId). Sono unite nello stesso
 * referenceType per non frammentare il contratto verso il registry.
 *
 * ESCLUSO di proposito: ClinicalSubjectIndex — è un mirror/cache locale di
 * TUTTI i subject del registry, non dato utente: conteggiarlo renderebbe ogni
 * subject non cancellabile.
 */
@Injectable()
export class SubjectDataSummaryService {
  constructor(private readonly tenantContext: TenantContextService) {}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  /**
   * Conteggi "semplici": una entity + una colonna che contiene il subjectId.
   * L'ordine determina l'ordine delle voci in `byType`.
   */
  private readonly simpleSpecs: SimpleCountSpec[] = [
    { referenceType: 'treatment', entity: Treatment, property: 'patientId' },
    { referenceType: 'therapeutic_path', entity: TherapeuticPath, property: 'patientId' },
    { referenceType: 'anamnesis', entity: PatientAnamnesis, property: 'subjectId' },
    { referenceType: 'waiting_list', entity: WaitingListEntry, property: 'patientId' },
    { referenceType: 'voucher_fe', entity: VoucherFe, property: 'patientId' },
    { referenceType: 'attendance_log', entity: ClinicalAttendanceLog, property: 'subjectId' },
    { referenceType: 'appointment_log', entity: AppointmentLog, property: 'patientId' },
    { referenceType: 'whatsapp_message', entity: WhatsappMessageLog, property: 'patientId' },
  ];

  /** Riepilogo per un singolo subject. */
  async getSummary(subjectId: string): Promise<SubjectDataSummary> {
    const [summary] = await this.getSummaries([subjectId]);
    return summary;
  }

  /**
   * Riepilogo per più subject in una sola passata. Usa query aggregate
   * (COUNT ... GROUP BY <col> WHERE <col> IN (:...ids)): una query per
   * referenceType, indipendentemente dal numero di subject.
   *
   * Ritorna un elemento per OGNI id richiesto, nello stesso ordine, anche se
   * hasData=false (così il caller può mappare per subjectId).
   */
  async getSummaries(subjectIds: string[]): Promise<SubjectDataSummary[]> {
    // byType per subjectId → referenceType → count
    const counts = new Map<string, Map<string, number>>();
    for (const id of subjectIds) counts.set(id, new Map());

    if (subjectIds.length === 0) return [];

    // Accumula un conteggio nella mappa (somma se il referenceType esiste già,
    // così "appointment" può sommare le due sorgenti).
    const accumulate = (referenceType: string, perSubject: Map<string, number>) => {
      for (const [sid, cnt] of perSubject) {
        if (cnt <= 0) continue;
        const bucket = counts.get(sid);
        if (!bucket) continue;
        bucket.set(referenceType, (bucket.get(referenceType) ?? 0) + cnt);
      }
    };

    // 1) appointment = AvailabilityAppointment + Appointment (legacy)
    accumulate(
      'appointment',
      await this.groupedCount(AvailabilityAppointment, 'patientId', subjectIds),
    );
    accumulate(
      'appointment',
      await this.groupedCount(Appointment, 'patientId', subjectIds),
    );

    // 2) evaluation = PatientEvaluation via join sul path del paziente
    accumulate('evaluation', await this.groupedEvaluationCount(subjectIds));

    // 3) conteggi semplici (entity + colonna diretta)
    for (const spec of this.simpleSpecs) {
      accumulate(
        spec.referenceType,
        await this.groupedCount(spec.entity, spec.property, subjectIds),
      );
    }

    // Ordine stabile delle voci in byType.
    const order = [
      'appointment',
      'treatment',
      'therapeutic_path',
      'evaluation',
      'anamnesis',
      'waiting_list',
      'voucher_fe',
      'attendance_log',
      'appointment_log',
      'whatsapp_message',
    ];

    return subjectIds.map((subjectId) => {
      const bucket = counts.get(subjectId) ?? new Map<string, number>();
      const byType: DataSummaryEntry[] = order
        .filter((rt) => (bucket.get(rt) ?? 0) > 0)
        .map((rt) => ({
          sourceModule: SOURCE_MODULE,
          referenceType: rt,
          count: bucket.get(rt) as number,
        }));
      const total = byType.reduce((sum, e) => sum + e.count, 0);
      return { subjectId, total, hasData: total > 0, byType };
    });
  }

  /**
   * COUNT(*) GROUP BY <property> per una entity con colonna che contiene
   * direttamente il subjectId. Ritorna Map<subjectId, count>. Il soft-delete
   * (deletedAt IS NULL) è applicato automaticamente da TypeORM sulle entity che
   * hanno DeleteDateColumn.
   */
  private async groupedCount(
    entity: EntityTarget<ObjectLiteral>,
    property: string,
    subjectIds: string[],
  ): Promise<Map<string, number>> {
    const rows = await this.dataSource
      .getRepository(entity)
      .createQueryBuilder('e')
      .select(`e.${property}`, 'sid')
      .addSelect('COUNT(*)', 'cnt')
      .where(`e.${property} IN (:...subjectIds)`, { subjectIds })
      .groupBy(`e.${property}`)
      .getRawMany<{ sid: string; cnt: string }>();

    const map = new Map<string, number>();
    for (const r of rows) {
      if (r.sid == null) continue;
      map.set(r.sid, parseInt(r.cnt, 10) || 0);
    }
    return map;
  }

  /**
   * PatientEvaluation non ha subjectId: si collega al paziente via il suo
   * TherapeuticPath (patient_evaluations.therapeuticPathId → therapeutic_paths).
   * Conta le valutazioni il cui percorso appartiene al subject.
   * Filtra i path soft-deleted (join manuale → il filtro deletedAt del path
   * non è automatico).
   */
  private async groupedEvaluationCount(
    subjectIds: string[],
  ): Promise<Map<string, number>> {
    const rows = await this.dataSource
      .getRepository(PatientEvaluation)
      .createQueryBuilder('ev')
      .innerJoin(TherapeuticPath, 'tp', 'tp.id = ev.therapeuticPathId')
      .select('tp.patientId', 'sid')
      .addSelect('COUNT(*)', 'cnt')
      .where('tp.patientId IN (:...subjectIds)', { subjectIds })
      .andWhere('tp.deletedAt IS NULL')
      .groupBy('tp.patientId')
      .getRawMany<{ sid: string; cnt: string }>();

    const map = new Map<string, number>();
    for (const r of rows) {
      if (r.sid == null) continue;
      map.set(r.sid, parseInt(r.cnt, 10) || 0);
    }
    return map;
  }
}
