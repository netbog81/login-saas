import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 2026-07-06 — Riassegnazione appuntamenti al sostituto palestra.
 *
 * Fino ad oggi la sostituzione (gym_exception_substitutes) era solo
 * visualizzazione calendario: gli appuntamenti restavano intestati
 * all'operatore assente, e con loro i trattamenti creati alla presenza →
 * fatturazione/conteggi istruttori attribuiti alla persona sbagliata.
 *
 * Da questa migration:
 *   - `reassignedByGymExceptionId`: traccia QUALE eccezione ha riassegnato
 *     l'appuntamento al sostituto. Serve per il ripristino chirurgico quando
 *     l'eccezione viene cancellata/modificata (si ripristinano SOLO gli
 *     appuntamenti riassegnati da quella eccezione, non altri).
 *     Nessuna FK: l'eccezione può essere cancellata prima del ripristino
 *     (il servizio ripristina PRIMA di cancellare, la colonna è un marker).
 *   - nuovo valore enum `operator_substituted` in appointment_logs.eventType
 *     per lo storico/statistiche delle riassegnazioni.
 *
 * Le colonne originalOperatorId/isSubstitution esistono già (migration
 * 1765156916002) ma non erano mai scritte: da ora le valorizza il servizio.
 *
 * DB-per-tenant: lanciare con override `DB_DATABASE=clinico_<hash>`.
 */
export class GymSubstituteReassignment1801000000000
  implements MigrationInterface
{
  name = 'GymSubstituteReassignment1801000000000';

  private static readonly TARGET_SCHEMA = 't_4701c4aaba73713294696ae7ae46d21b';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;

    if (
      currentSchema !== GymSubstituteReassignment1801000000000.TARGET_SCHEMA &&
      currentSchema !== 'public'
    ) {
      throw new Error(
        `Migration pensata per lo schema ${GymSubstituteReassignment1801000000000.TARGET_SCHEMA} o public, trovato ${currentSchema}`,
      );
    }

    await queryRunner.query(
      `ALTER TABLE "availability_appointments" ADD COLUMN IF NOT EXISTS "reassignedByGymExceptionId" uuid`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_availability_appointments_reassigned_by" ON "availability_appointments" ("reassignedByGymExceptionId") WHERE "reassignedByGymExceptionId" IS NOT NULL`,
    );

    // ALTER TYPE ... ADD VALUE non può girare dentro una transazione in PG < 12;
    // su PG >= 12 è consentito. IF NOT EXISTS lo rende idempotente.
    await queryRunner.query(
      `ALTER TYPE "public"."appointment_logs_eventtype_enum" ADD VALUE IF NOT EXISTS 'operator_substituted'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_availability_appointments_reassigned_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "availability_appointments" DROP COLUMN IF EXISTS "reassignedByGymExceptionId"`,
    );
    // Il valore enum non viene rimosso: PG non supporta DROP VALUE.
  }
}
