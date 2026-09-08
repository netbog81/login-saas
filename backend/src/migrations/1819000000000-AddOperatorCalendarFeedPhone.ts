import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Numero di telefono del paziente nel feed ICS dell'operatore.
 *
 * Richiesta d'uso concreta: l'operatore che guarda l'agenda dal telefono deve
 * poter chiamare il paziente in caso di necessità, senza aprire il gestionale.
 *
 * Interruttore separato da `calendarFeedShowPatientName` di proposito: sono
 * due esposizioni diverse. Il nome dice CHI, il numero permette di
 * RAGGIUNGERLO, e chi trovasse il link avrebbe in mano una rubrica di persone
 * associate a uno studio sanitario. Chi vuole solo sapere se è libero non deve
 * pagare né l'una né l'altra.
 */
export class AddOperatorCalendarFeedPhone1819000000000 implements MigrationInterface {
  name = 'AddOperatorCalendarFeedPhone1819000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "operators"
      ADD COLUMN IF NOT EXISTS "calendarFeedShowPatientPhone" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "operators"
      DROP COLUMN IF EXISTS "calendarFeedShowPatientPhone"
    `);
  }
}
