import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Raggruppamento anche per gli spostamenti e le disdette.
 *
 * Finora solo le PRENOTAZIONI venivano accorpate: chi prendeva tre
 * appuntamenti in una telefonata riceveva un elenco solo, ma chi ne spostava
 * tre riceveva tre messaggi separati, a dieci secondi l'uno dall'altro (è la
 * distanza minima che il gateway tiene fra due messaggi automatici). Con una
 * serie ricorrente da dodici sedute diventavano dodici messaggi in due minuti.
 *
 * Ora spostamenti e disdette hanno un proprio raggruppamento, con la stessa
 * finestra delle prenotazioni (`recapBufferSeconds`, già configurabile): un
 * messaggio per gli spostati e uno per i disdetti, mai mescolati fra loro.
 *
 * Servono due nuovi template — l'elenco degli spostati e l'elenco dei
 * disdetti — e due nuovi tipi di log per le righe aggregate.
 */
export class AddWhatsappGroupedUpdateCancel1822000000000 implements MigrationInterface {
  name = 'AddWhatsappGroupedUpdateCancel1822000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const schema = (queryRunner.connection.options as any).schema || 'public';

    // ALTER TYPE ... ADD VALUE non può stare dentro una transazione, e il nuovo
    // valore non è usabile nella stessa transazione che lo crea: si esce dalla
    // transazione della migration, si estendono gli enum, si rientra.
    await queryRunner.query(`COMMIT`);
    await queryRunner.query(`
      ALTER TYPE "${schema}"."whatsapp_template_type_enum"
      ADD VALUE IF NOT EXISTS 'UPDATE_MULTI'
    `);
    await queryRunner.query(`
      ALTER TYPE "${schema}"."whatsapp_template_type_enum"
      ADD VALUE IF NOT EXISTS 'CANCELLATION_MULTI'
    `);
    await queryRunner.query(`
      ALTER TYPE "${schema}"."whatsapp_message_type_enum"
      ADD VALUE IF NOT EXISTS 'update_multi'
    `);
    await queryRunner.query(`
      ALTER TYPE "${schema}"."whatsapp_message_type_enum"
      ADD VALUE IF NOT EXISTS 'cancellation_multi'
    `);
    await queryRunner.query(`BEGIN`);

    // `{appointments}` lo compone il gateway alla chiusura della finestra: è
    // l'unico a sapere quanti appuntamenti ci sono finiti dentro.
    await queryRunner.query(`
      INSERT INTO "whatsapp_message_templates" ("templateType", "bodyTemplate", "isActive")
      VALUES (
        'UPDATE_MULTI',
        'Gentile {name}, i suoi appuntamenti sono stati spostati:' || chr(10) || '{appointments}',
        true
      )
      ON CONFLICT ("templateType") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "whatsapp_message_templates" ("templateType", "bodyTemplate", "isActive")
      VALUES (
        'CANCELLATION_MULTI',
        'Gentile {name}, i seguenti appuntamenti sono stati cancellati:' || chr(10) || '{appointments}',
        true
      )
      ON CONFLICT ("templateType") DO NOTHING
    `);

    // Il template dello spostamento singolo può ora dire da DOVE si è mosso.
    // Si tocca solo se il tenant non l'ha mai personalizzato, cioè se è ancora
    // identico al default con cui era stato creato: riscrivere un testo scelto
    // dallo studio sarebbe un abuso.
    await queryRunner.query(`
      UPDATE "whatsapp_message_templates"
      SET "bodyTemplate" = 'Gentile {name}, il suo appuntamento del {oldDate} alle {oldTime} è stato spostato al {date} alle {time}.'
      WHERE "templateType" = 'UPDATE'
        AND "bodyTemplate" = 'Gentile {name}, il suo appuntamento è stato spostato al {date} alle {time}.'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "whatsapp_message_templates"
      WHERE "templateType" IN ('UPDATE_MULTI', 'CANCELLATION_MULTI')
    `);

    await queryRunner.query(`
      UPDATE "whatsapp_message_templates"
      SET "bodyTemplate" = 'Gentile {name}, il suo appuntamento è stato spostato al {date} alle {time}.'
      WHERE "templateType" = 'UPDATE'
        AND "bodyTemplate" = 'Gentile {name}, il suo appuntamento del {oldDate} alle {oldTime} è stato spostato al {date} alle {time}.'
    `);

    // I valori aggiunti a un enum PostgreSQL non sono rimovibili.
    console.warn(
      "NOTA: 'UPDATE_MULTI', 'CANCELLATION_MULTI', 'update_multi' e 'cancellation_multi' restano negli enum",
    );
  }
}
