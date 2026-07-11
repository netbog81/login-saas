import { Injectable } from '@nestjs/common';
import { EntityTarget, ObjectLiteral } from 'typeorm';
import { TenantContextService } from '@curandis/tenant-datasource';

import { AvailabilityAppointment } from '../../modules/availability/entities/availability-appointment.entity';
import { Appointment } from '../../entities/appointment.entity';
import { Treatment } from '../../modules/availability/entities/treatment.entity';
import { TherapeuticPath } from '../../modules/availability/entities/therapeutic-path.entity';
import { PatientAnamnesis } from '../../modules/availability/entities/patient-anamnesis.entity';
import { WaitingListEntry } from '../../modules/availability/entities/waiting-list-entry.entity';
import { VoucherFe } from '../../modules/availability/entities/voucher-fe.entity';
import { ClinicalAttendanceLog } from '../entities/clinical-attendance-log.entity';
import { AppointmentLog } from '../../modules/availability/entities/appointment-log.entity';
import { WhatsappMessageLog } from '../../modules/whatsapp/log/entities/whatsapp-message-log.entity';
import { ClinicalSubjectIndex } from '../entities/clinical-subject-index.entity';

import { MergeConflict, MergePreview, MergeResult } from '../dto/subject-merge.dto';

/**
 * Riferimento a una entity patient-bearing e alla PROPRIETÀ TypeORM che
 * contiene il subjectId del registry (il nome DB della colonna è mappato da
 * TypeORM, quindi vale sia per `patientId` che per `subjectId`→`subject_id`).
 */
interface EntityRef {
  entity: EntityTarget<ObjectLiteral>;
  property: string;
}

/**
 * Uno "spostamento many-per-patient": una o più entity riassegnate in blocco
 * loser→winner sotto lo stesso referenceType (es. "appointment" somma la entity
 * corrente AvailabilityAppointment + la legacy Appointment, come nel
 * data-summary).
 */
interface ManyMoveSpec {
  referenceType: string;
  refs: EntityRef[];
}

/**
 * SubjectMergeService — riassegna S2S tutti i dati clinici da un subject "loser"
 * a un subject "winner", per consolidare anagrafiche duplicate lato registry.
 *
 * Isolamento tenant: identico al SubjectDataSummaryService — il DataSource è
 * quello del tenant corrente (DB-per-tenant, risolto dal middleware auth-core in
 * AsyncLocalStorage). Nessun filtro organizationId: l'intero database è già
 * scoped al tenant.
 *
 * Insieme delle tabelle: DEVE combaciare con quelle contate dal data-summary
 * (meno clinical_subject_index), così dopo merge-execute il loser riporta
 * hasData=false. `evaluation` non ha un patientId proprio: segue il suo
 * TherapeuticPath, quindi spostare i therapeutic_paths sposta anche le
 * valutazioni — NON va gestita a parte (niente doppio handling).
 *
 * clinical_subject_index NON viene riassegnato: è un mirror/cache locale, non
 * dato utente. La riga del loser viene ELIMINATA (quella del winner resta / si
 * ri-sincronizza dagli eventi del registry).
 */
@Injectable()
export class SubjectMergeService {
  constructor(private readonly tenantContext: TenantContextService) {}

  /** DataSource del tenant corrente (AsyncLocalStorage). */
  private get dataSource() {
    const ds = this.tenantContext.getDataSource();
    if (!ds) throw new Error('No tenant DataSource in current request context');
    return ds;
  }

  /**
   * Tabelle many-per-patient: UPDATE in blocco della colonna subjectId
   * loser→winner. L'ordine determina l'ordine delle voci in moves/moved.
   */
  private readonly manySpecs: ManyMoveSpec[] = [
    {
      referenceType: 'appointment',
      refs: [
        { entity: AvailabilityAppointment, property: 'patientId' },
        { entity: Appointment, property: 'patientId' },
      ],
    },
    { referenceType: 'treatment', refs: [{ entity: Treatment, property: 'patientId' }] },
    { referenceType: 'therapeutic_path', refs: [{ entity: TherapeuticPath, property: 'patientId' }] },
    { referenceType: 'waiting_list', refs: [{ entity: WaitingListEntry, property: 'patientId' }] },
    { referenceType: 'voucher_fe', refs: [{ entity: VoucherFe, property: 'patientId' }] },
    { referenceType: 'attendance_log', refs: [{ entity: ClinicalAttendanceLog, property: 'subjectId' }] },
    { referenceType: 'appointment_log', refs: [{ entity: AppointmentLog, property: 'patientId' }] },
    { referenceType: 'whatsapp_message', refs: [{ entity: WhatsappMessageLog, property: 'patientId' }] },
  ];

  /**
   * Anteprima (dry-run): cosa FAREBBE la merge, senza modificare nulla.
   * I conteggi includono anche le righe soft-deleted (withDeleted:true) perché
   * l'esecuzione le sposta comunque — così moves combacia con moved.
   */
  async preview(winnerId: string, loserId: string): Promise<MergePreview> {
    const moves: Array<{ referenceType: string; count: number }> = [];

    for (const spec of this.manySpecs) {
      let count = 0;
      for (const ref of spec.refs) {
        count += await this.dataSource.getRepository(ref.entity).count({
          where: { [ref.property]: loserId },
          withDeleted: true,
        });
      }
      if (count > 0) moves.push({ referenceType: spec.referenceType, count });
    }

    // anamnesi: 1:1 per subject (unique subject_id). Preview del winner-wins.
    const conflicts: MergeConflict[] = [];
    const anamnesisRepo = this.dataSource.getRepository(PatientAnamnesis);
    const loserHasAnamnesis =
      (await anamnesisRepo.count({ where: { subjectId: loserId } })) > 0;
    const winnerHasAnamnesis =
      (await anamnesisRepo.count({ where: { subjectId: winnerId } })) > 0;

    if (loserHasAnamnesis && winnerHasAnamnesis) {
      conflicts.push({
        referenceType: 'anamnesis',
        kind: 'one_to_one',
        winnerHasData: true,
        loserHasData: true,
        autoResolution: 'winner_wins',
      });
    } else if (loserHasAnamnesis && !winnerHasAnamnesis) {
      moves.push({ referenceType: 'anamnesis', count: 1 });
    }

    return {
      winnerSubjectId: winnerId,
      loserSubjectId: loserId,
      moves,
      conflicts,
    };
  }

  /**
   * Esegue la riassegnazione in un'unica transazione DB. Idempotente: rilanciata
   * dopo una merge completata non trova righe del loser e ritorna moved vuoto.
   * UPDATE bulk (non riga-per-riga), conteggio via UpdateResult.affected.
   */
  async execute(winnerId: string, loserId: string): Promise<MergeResult> {
    return this.dataSource.transaction(async (manager) => {
      const moved: Array<{ referenceType: string; count: number }> = [];
      const discarded: Array<{ referenceType: string; detail: string }> = [];

      // 1) tabelle many-per-patient: UPDATE bulk loser→winner.
      for (const spec of this.manySpecs) {
        let affected = 0;
        for (const ref of spec.refs) {
          const res = await manager.update(
            ref.entity,
            { [ref.property]: loserId },
            { [ref.property]: winnerId },
          );
          affected += res.affected ?? 0;
        }
        if (affected > 0) moved.push({ referenceType: spec.referenceType, count: affected });
      }

      // 2) anamnesi: 1:1 per subject (vincolo unique subject_id). Winner vince.
      const anamnesisRepo = manager.getRepository(PatientAnamnesis);
      const loserAnamnesis = await anamnesisRepo.findOne({
        where: { subjectId: loserId },
      });
      if (loserAnamnesis) {
        const winnerAnamnesis = await anamnesisRepo.findOne({
          where: { subjectId: winnerId },
        });
        if (winnerAnamnesis) {
          // Il winner ha già un'anamnesi: spostare violerebbe il vincolo unique.
          // Si scarta quella del loser, registrandola in `discarded`.
          await anamnesisRepo.delete({ id: loserAnamnesis.id });
          const createdAt =
            loserAnamnesis.createdAt instanceof Date
              ? loserAnamnesis.createdAt.toISOString()
              : String(loserAnamnesis.createdAt);
          discarded.push({
            referenceType: 'anamnesis',
            detail:
              `anamnesi del subject ${loserId} scartata (id=${loserAnamnesis.id}, ` +
              `creata il ${createdAt}) — il winner aveva già un'anamnesi`,
          });
        } else {
          // Il winner non ha anamnesi: si riassegna quella del loser.
          const res = await anamnesisRepo.update(
            { id: loserAnamnesis.id },
            { subjectId: winnerId },
          );
          if ((res.affected ?? 0) > 0) {
            moved.push({ referenceType: 'anamnesis', count: res.affected ?? 1 });
          }
        }
      }

      // 3) clinical_subject_index: mirror locale, NON dato utente. Si elimina la
      // riga del loser (quella del winner resta / si ri-sincronizza dagli eventi
      // registry). Non entra in moved/discarded (nota interna soltanto).
      await manager.getRepository(ClinicalSubjectIndex).delete({ subjectId: loserId });

      return {
        winnerSubjectId: winnerId,
        loserSubjectId: loserId,
        moved,
        discarded,
      };
    });
  }
}
