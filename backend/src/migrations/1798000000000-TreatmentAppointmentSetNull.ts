import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 2026-07-04 — Il trattamento sopravvive alla cancellazione dell'appuntamento.
 *
 * La FK treatments.appointmentId era ON DELETE CASCADE: la cancellazione
 * FISICA di un appuntamento (mutation deleteAppointment, usata dal
 * calendario e dal flusso copia/incolla) eliminava in cascata il trattamento
 * collegato — anche se in corso, chiuso o già FATTURATO — senza alcun evento
 * verso accounting. Incident: 6 trattamenti (4 fatturati + 2 pending in
 * accounting) spariti dal clinico su tenant bdq, rilevati 2026-07-04.
 *
 * Regola di business (decisa da Marco): un trattamento in corso o eseguito
 * NON deve MAI essere perso per effetto della cancellazione del suo
 * appuntamento. Quindi:
 *   - appointmentId diventa NULLABLE
 *   - FK passa da ON DELETE CASCADE a ON DELETE SET NULL
 * Il GraphQL espone già `appointment` nullable e il frontend ha il fallback
 * su startedAt per data/ora.
 *
 * DB-per-tenant (post-containerizzazione 2026-06-11): lanciare con override
 * `DB_DATABASE=clinico_<hash>`; gira sullo schema `public` del DB del tenant.
 * ALTER su tabella esistente → eredita i grant già concessi a `*_svc`.
 */
export class TreatmentAppointmentSetNull1798000000000
  implements MigrationInterface
{
  name = 'TreatmentAppointmentSetNull1798000000000';

  private static readonly TARGET_SCHEMA = 't_4701c4aaba73713294696ae7ae46d21b';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;

    if (
      currentSchema !== TreatmentAppointmentSetNull1798000000000.TARGET_SCHEMA &&
      currentSchema !== 'public'
    ) {
      throw new Error(
        `TreatmentAppointmentSetNull: rifiuto di girare sullo schema "${currentSchema}". ` +
          `Schema autorizzati: "${TreatmentAppointmentSetNull1798000000000.TARGET_SCHEMA}", "public".`,
      );
    }

    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);

    await queryRunner.query(`
      ALTER TABLE "treatments"
      ALTER COLUMN "appointmentId" DROP NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "treatments"
      DROP CONSTRAINT IF EXISTS "FK_treatments_appointment"
    `);

    await queryRunner.query(`
      ALTER TABLE "treatments"
      ADD CONSTRAINT "FK_treatments_appointment"
      FOREIGN KEY ("appointmentId") REFERENCES "availability_appointments"(id)
      ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const currentSchema: string = (
      await queryRunner.query('SELECT current_schema() AS s')
    )[0].s;
    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);

    await queryRunner.query(`
      ALTER TABLE "treatments"
      DROP CONSTRAINT IF EXISTS "FK_treatments_appointment"
    `);

    // NB: il revert fallisce se esistono righe con appointmentId NULL
    // (trattamenti sopravvissuti a una cancellazione appuntamento): vanno
    // gestite a mano prima di ripristinare NOT NULL + CASCADE.
    await queryRunner.query(`
      ALTER TABLE "treatments"
      ALTER COLUMN "appointmentId" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "treatments"
      ADD CONSTRAINT "FK_treatments_appointment"
      FOREIGN KEY ("appointmentId") REFERENCES "availability_appointments"(id)
      ON DELETE CASCADE
    `);
  }
}
