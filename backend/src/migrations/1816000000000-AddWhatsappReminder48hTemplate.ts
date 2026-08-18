import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Template del promemoria per gli invii che partono DUE giorni prima.
 *
 * Serve alla politica SHIFT_PREVIOUS_DAY della fascia oraria (migration 1815):
 * gli appuntamenti che iniziano prima della fine della fascia ricevono il
 * promemoria nella fascia del giorno ancora precedente, per non scendere sotto
 * le 24h di preavviso. In quel caso il testo di REMINDER_24H, che dice
 * "domani", sarebbe sbagliato.
 *
 * Il gateway sceglie da solo quale dei due usare in base a quanti giorni
 * mancano all'appuntamento; se REMINDER_48H manca o è disattivato ricade su
 * REMINDER_24H, quindi il comportamento non cambia finché il tenant non lo
 * compila.
 */
export class AddWhatsappReminder48hTemplate1816000000000 implements MigrationInterface {
  name = 'AddWhatsappReminder48hTemplate1816000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schema = (queryRunner.connection.options as any).schema || 'public';

    // ALTER TYPE ... ADD VALUE non può stare dentro una transazione, e il nuovo
    // valore non è usabile nella stessa transazione che lo crea: si esce dalla
    // transazione della migration, si estende l'enum, si rientra.
    await queryRunner.query(`COMMIT`);
    await queryRunner.query(`
      ALTER TYPE "${schema}"."whatsapp_template_type_enum"
      ADD VALUE IF NOT EXISTS 'REMINDER_48H'
    `);
    await queryRunner.query(`BEGIN`);

    await queryRunner.query(`
      INSERT INTO "whatsapp_message_templates" ("templateType", "bodyTemplate", "isActive")
      VALUES (
        'REMINDER_48H',
        'Gentile {name}, le confermiamo il suo appuntamento per dopodomani alle {time}.',
        true
      )
      ON CONFLICT ("templateType") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "whatsapp_message_templates" WHERE "templateType" = 'REMINDER_48H'
    `);
    // I valori aggiunti a un enum PostgreSQL non sono rimovibili.
    console.warn("NOTA: 'REMINDER_48H' resta nell'enum whatsapp_template_type_enum");
  }
}
