import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * La data e ora che il messaggio ha effettivamente comunicato al paziente.
 *
 * Senza questa colonna "l'appuntamento è stato spostato e il paziente non lo
 * sa" non è una domanda a cui si possa rispondere: il log dice che un
 * messaggio è partito, non cosa diceva, e nel clinico non esiste uno storico
 * degli appuntamenti da cui ricostruire la data precedente. L'unica
 * alternativa sarebbe rileggere `messageBody` cercandoci dentro una data —
 * che si rompe al primo template modificato.
 *
 * `timestamp` senza fuso, come `createdAt` in questa stessa tabella: il
 * valore è l'ora del calendario dello studio, la stessa che il paziente legge
 * nel messaggio. Così il confronto con l'appuntamento è l'espressione SQL
 * `"appointmentDate" + "startTime"` e non passa da nessuna conversione — che
 * su un host in UTC e uno studio in Europe/Rome sposterebbe tutto di due ore.
 *
 * Nullable, e resta nullo per tutto lo storico: le righe vecchie non possono
 * dire cosa annunciavano, e inventarlo dal `createdAt` produrrebbe falsi
 * "spostamento non comunicato" su appuntamenti a posto.
 */
export class AddMessageLogAnnouncedFor1828000000000 implements MigrationInterface {
  name = 'AddMessageLogAnnouncedFor1828000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE whatsapp_message_logs
      ADD COLUMN IF NOT EXISTS "announcedFor" timestamp
    `);

    // Un recap raggruppato cita più appuntamenti e li tiene in `appointmentIds`.
    // La riconciliazione chiede "esiste un messaggio che nomina QUESTO
    // appuntamento?" per ogni appuntamento futuro: senza indice GIN è una
    // scansione dell'intera tabella per ognuno.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_wa_logs_appointment_ids"
      ON whatsapp_message_logs USING GIN ("appointmentIds")
    `);

    // I grant stanno sulla tabella, che esiste già: aggiungere una colonna
    // non ne richiede di nuovi.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_wa_logs_appointment_ids"`);
    await queryRunner.query(`ALTER TABLE whatsapp_message_logs DROP COLUMN IF EXISTS "announcedFor"`);
  }
}
