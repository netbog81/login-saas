import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 2026-07-31 — GESTIONE ASSENZE INGIUSTIFICATE (Statistiche → No Show).
 *
 * La pagina "No Show" legge dagli APPUNTAMENTI (availability_appointments),
 * non dal log: è l'unica sorgente che ha già operatore, data/ora, tipo
 * (studio/palestra), sede, motivo e ore di preavviso, ed è retroattiva sullo
 * storico esistente. Questa migration aggiunge quello che manca:
 *
 *  1. clinical_attendance_log: nuovo eventType LATE_ARRIVAL + revoked_at.
 *     Fino a oggi il "ritardatario" (segnato NO_SHOW e poi rimesso
 *     Presentato) faceva CANCELLARE la riga di log → traccia distrutta.
 *     Ora la riga viene DEGRADATA a LATE_ARRIVAL: non pesa più come
 *     no-show ma resta storicizzata.
 *
 *  2. availability_appointments: campi ritardo.
 *     - wasNoShowReverted: era stato dato per assente, poi si è presentato
 *     - arrivedAt / lateMinutes: ritardo misurato (solo su markAttended
 *       MANUALE — mai dal cron auto-attendance, che marca ATTENDED
 *       all'orario teorico e falserebbe il dato)
 *     - arrivalMarkedBy / arrivalSource: chi e come (segreteria, operatore,
 *       revoca no-show), per distinguere un ritardo misurato da uno
 *       dichiarato a posteriori
 *
 *  3. no_show_reviews: la decisione dello staff su ogni evento
 *     (addebita / esonera / da decidere). Riservata ai ruoli di
 *     fatturazione (BillingWriteGuard), 1 riga per appuntamento.
 *
 *  4. general_settings: soglia disdetta tardiva (era hardcoded a 24h in
 *     AvailabilityAppointmentService.cancelAppointment) e tolleranza
 *     ritardo in minuti.
 *
 * DB-per-tenant: lanciare con `npx ts-node scripts/run-migration.ts <alias>`.
 */
export class CreateNoShowManagement1812000000000 implements MigrationInterface {
  name = 'CreateNoShowManagement1812000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;
    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);

    // ========================================================================
    // 1. clinical_attendance_log — LATE_ARRIVAL + revoca
    // ========================================================================
    // ALTER TYPE ... ADD VALUE non è transazionale su PG < 12; da PG 12 in poi
    // funziona dentro transazione purché il valore non venga usato nella
    // stessa. Qui lo usiamo solo da codice applicativo → nessun problema.
    await queryRunner.query(`
      ALTER TYPE "clinical_attendance_log_event_type_enum"
        ADD VALUE IF NOT EXISTS 'LATE_ARRIVAL'
    `);

    await queryRunner.query(`
      ALTER TABLE "clinical_attendance_log"
        ADD COLUMN IF NOT EXISTS "revoked_at" timestamptz
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_attendance_appointment"
        ON "clinical_attendance_log" ("appointment_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_attendance_occurred_at"
        ON "clinical_attendance_log" ("occurred_at")
    `);

    // ========================================================================
    // 2. availability_appointments — tracking ritardatari
    // ========================================================================
    await queryRunner.query(`
      ALTER TABLE "availability_appointments"
        ADD COLUMN IF NOT EXISTS "wasNoShowReverted" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "arrivedAt"         TIMESTAMP,
        ADD COLUMN IF NOT EXISTS "lateMinutes"       integer,
        ADD COLUMN IF NOT EXISTS "arrivalMarkedBy"   uuid,
        ADD COLUMN IF NOT EXISTS "arrivalSource"     varchar(32)
    `);

    // Indice parziale: le query della pagina No Show filtrano sempre su un
    // sottoinsieme piccolo di stati rispetto al totale degli appuntamenti.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_availability_appointments_no_show"
        ON "availability_appointments" ("appointmentDate", "bookingStatus")
        WHERE "bookingStatus" IN ('no_show', 'cancelled_late', 'cancelled_early', 'cancelled')
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_availability_appointments_late"
        ON "availability_appointments" ("appointmentDate")
        WHERE "lateMinutes" IS NOT NULL OR "wasNoShowReverted" = true
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_availability_appointments_patient_date"
        ON "availability_appointments" ("patientId", "appointmentDate")
    `);

    // ========================================================================
    // 3. no_show_reviews — decisione staff (addebita / esonera)
    // ========================================================================
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "no_show_review_decision_enum"
          AS ENUM ('PENDING', 'TO_CHARGE', 'WAIVED', 'JUSTIFIED');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "no_show_reviews" (
        "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "appointmentId"  uuid NOT NULL,
        "patientId"      uuid,
        "decision"       "no_show_review_decision_enum" NOT NULL DEFAULT 'PENDING',
        "notes"          text,
        "chargedAmount"  numeric(12,2),
        "decidedBy"      uuid,
        "decidedByName"  varchar(255),
        "decidedAt"      timestamptz,
        "createdAt"      timestamptz NOT NULL DEFAULT now(),
        "updatedAt"      timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_no_show_reviews_appointment" UNIQUE ("appointmentId"),
        CONSTRAINT "FK_no_show_reviews_appointment"
          FOREIGN KEY ("appointmentId")
          REFERENCES "availability_appointments" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_no_show_reviews_patient"
        ON "no_show_reviews" ("patientId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_no_show_reviews_decision"
        ON "no_show_reviews" ("decision")
    `);

    // ========================================================================
    // 4. general_settings — soglie configurabili
    // ========================================================================
    await queryRunner.query(`
      INSERT INTO "general_settings" ("key", "value", "description", "valueType", "category")
      VALUES
        ('noShow.lateCancellationHours', '24'::jsonb,
         'Ore di preavviso sotto le quali una disdetta è considerata tardiva (assenza ingiustificata)',
         'number', 'noShow'),
        ('noShow.lateArrivalToleranceMinutes', '15'::jsonb,
         'Minuti di ritardo oltre i quali l''arrivo del paziente viene conteggiato come ritardo rilevante',
         'number', 'noShow'),
        ('noShow.recentWindowDays', '30'::jsonb,
         'Finestra scorrevole "recente" (giorni) usata nel profilo del paziente della pagina No Show',
         'number', 'noShow')
      ON CONFLICT ("key") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;
    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);

    await queryRunner.query(`
      DELETE FROM "general_settings" WHERE "category" = 'noShow'
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "no_show_reviews"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "no_show_review_decision_enum"`);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_availability_appointments_patient_date"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_availability_appointments_late"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_availability_appointments_no_show"`,
    );
    await queryRunner.query(`
      ALTER TABLE "availability_appointments"
        DROP COLUMN IF EXISTS "arrivalSource",
        DROP COLUMN IF EXISTS "arrivalMarkedBy",
        DROP COLUMN IF EXISTS "lateMinutes",
        DROP COLUMN IF EXISTS "arrivedAt",
        DROP COLUMN IF EXISTS "wasNoShowReverted"
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_attendance_occurred_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_attendance_appointment"`);
    await queryRunner.query(`
      ALTER TABLE "clinical_attendance_log" DROP COLUMN IF EXISTS "revoked_at"
    `);
    // Il valore 'LATE_ARRIVAL' dell'enum non è rimovibile in PostgreSQL
    // senza ricreare il tipo: lo si lascia (innocuo).
  }
}
