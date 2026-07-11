import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PARTE 2 — Sincronizzazione pagamenti clinico ↔ accounting (first-write-wins).
 *
 * Aggiunge su `treatments`:
 *   paymentId             uuid NULL     — UUID dell'incasso vincitore (chiave
 *                                          logica di idempotenza first-write-wins)
 *   paymentRecordedSource varchar(20)   — 'clinical' | 'accounting' (audit/UI)
 *
 * Il vero lock di idempotenza è la guardia atomica `UPDATE ... WHERE isPaid=false`
 * (row lock Postgres): il primo che committa vince, gli altri ottengono RETURNING
 * vuoto e vengono scartati senza errore. paymentId/source servono per audit e per
 * echeggiare l'identità dell'incasso negli eventi RabbitMQ.
 *
 * DB-per-tenant: lanciare con override `DB_DATABASE=clinico_<hash>`. Gira sullo
 * schema `public` del DB del tenant (o sullo schema storico per retro-compat).
 */
export class AddTreatmentPaymentSyncFields1792000000000
  implements MigrationInterface
{
  name = 'AddTreatmentPaymentSyncFields1792000000000';

  private static readonly TARGET_SCHEMA = 't_4701c4aaba73713294696ae7ae46d21b';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;

    if (
      currentSchema !== AddTreatmentPaymentSyncFields1792000000000.TARGET_SCHEMA &&
      currentSchema !== 'public'
    ) {
      throw new Error(
        `AddTreatmentPaymentSyncFields: rifiuto di girare sullo schema "${currentSchema}". ` +
          `Schema autorizzati: "${AddTreatmentPaymentSyncFields1792000000000.TARGET_SCHEMA}", "public".`,
      );
    }

    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);

    await queryRunner.query(`
      ALTER TABLE "treatments"
      ADD COLUMN IF NOT EXISTS "paymentId"             uuid,
      ADD COLUMN IF NOT EXISTS "paymentRecordedSource" varchar(20)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;

    if (
      currentSchema !== AddTreatmentPaymentSyncFields1792000000000.TARGET_SCHEMA &&
      currentSchema !== 'public'
    ) {
      throw new Error(
        `AddTreatmentPaymentSyncFields.down: rifiuto sullo schema "${currentSchema}".`,
      );
    }

    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);
    await queryRunner.query(`
      ALTER TABLE "treatments"
      DROP COLUMN IF EXISTS "paymentRecordedSource",
      DROP COLUMN IF EXISTS "paymentId"
    `);
  }
}
