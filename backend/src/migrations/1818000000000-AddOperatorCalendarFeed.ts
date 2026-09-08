import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Feed ICS per operatore: sottoscrizione dell'agenda da iOS, Google Calendar,
 * Outlook.
 *
 * Perché un feed e non un'integrazione vera: Google Calendar non si scrive con
 * una API key (serve OAuth col consenso del singolo operatore e un consent
 * screen verificato da Google) e Apple non espone nessuna API di calendario.
 * La sottoscrizione a un URL .ics è l'unico meccanismo che funziona nativamente
 * su tutti e tre senza custodire credenziali di nessuno.
 *
 * `calendarFeedToken` è l'unica credenziale: chi ha l'URL legge l'agenda. Da
 * qui le altre colonne — si revoca (`calendarFeedRevokedAt`), si rigenera, e il
 * nome del paziente compare SOLO se l'operatore attiva esplicitamente
 * `calendarFeedShowPatientName`, accettando che quel dato viaggi su un URL non
 * autenticato.
 */
export class AddOperatorCalendarFeed1818000000000 implements MigrationInterface {
  name = 'AddOperatorCalendarFeed1818000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "operators"
      ADD COLUMN IF NOT EXISTS "calendarFeedToken" character varying(64),
      ADD COLUMN IF NOT EXISTS "calendarFeedEnabled" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "calendarFeedShowPatientName" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "calendarFeedCreatedAt" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "calendarFeedRevokedAt" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "calendarFeedLastAccessAt" TIMESTAMP
    `);

    // Unique sul token: è la chiave di lookup del feed, e due operatori con lo
    // stesso token significherebbe un'agenda mostrata alla persona sbagliata.
    // Parziale, perché i NULL sono la norma (chi non ha mai attivato il feed).
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_operators_calendar_feed_token"
      ON "operators" ("calendarFeedToken")
      WHERE "calendarFeedToken" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_operators_calendar_feed_token"`);
    await queryRunner.query(`
      ALTER TABLE "operators"
      DROP COLUMN IF EXISTS "calendarFeedToken",
      DROP COLUMN IF EXISTS "calendarFeedEnabled",
      DROP COLUMN IF EXISTS "calendarFeedShowPatientName",
      DROP COLUMN IF EXISTS "calendarFeedCreatedAt",
      DROP COLUMN IF EXISTS "calendarFeedRevokedAt",
      DROP COLUMN IF EXISTS "calendarFeedLastAccessAt"
    `);
  }
}
