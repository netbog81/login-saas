import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sottoscrizione del paziente al calendario dei propri appuntamenti.
 *
 * PERCHÉ UNA SOTTOSCRIZIONE E NON UN INVITO: un invito iMIP porta un
 * appuntamento solo — lo standard iTIP vuole un UID per messaggio, e i client
 * veri processano il primo evento e ignorano il resto. Con gli inviti
 * servirebbe una mail per appuntamento e un'altra a ogni spostamento. Con la
 * sottoscrizione si manda un link UNA VOLTA e il calendario del paziente si
 * aggiorna da solo per sempre, senza altre mail.
 *
 * IL LIMITE, da dire al paziente e non da nascondere: su iPhone il link
 * funziona al volo, mentre chi ha Google deve completare la sottoscrizione una
 * volta da computer — l'app Google Calendar non sa aggiungere un calendario da
 * URL. Dopo quella volta si aggiorna da sé anche sul telefono.
 *
 * Due segreti distinti per riga: `token` dà accesso al calendario,
 * `unsubscribeToken` serve solo a spegnerlo. Tenerli separati vuol dire che il
 * link "annulla iscrizione" in fondo alla mail si può aprire e inoltrare senza
 * portarsi dietro la credenziale del calendario.
 *
 * Le date non sono decorazione: `emailSentAt` dice che il link è partito,
 * `firstAccessAt` che il paziente l'ha davvero messo nel telefono. Sono due
 * cose diverse — la mail può essere finita nello spam — e senza la seconda
 * nessuno saprebbe quanti pazienti stanno davvero usando la funzione.
 */
export class CreatePatientCalendarFeeds1823000000000 implements MigrationInterface {
  name = 'CreatePatientCalendarFeeds1823000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "patient_calendar_feeds" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "patientId" uuid NOT NULL,
        "token" character varying(64),
        "unsubscribeToken" character varying(64),
        "enabled" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "emailSentAt" TIMESTAMP WITH TIME ZONE,
        "emailSentTo" character varying(255),
        "firstAccessAt" TIMESTAMP WITH TIME ZONE,
        "lastAccessAt" TIMESTAMP WITH TIME ZONE,
        "revokedAt" TIMESTAMP WITH TIME ZONE,
        "revokedBy" character varying(20),
        CONSTRAINT "PK_patient_calendar_feeds" PRIMARY KEY ("id")
      )
    `);

    // Una sottoscrizione per paziente: è del paziente, non dell'appuntamento.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_patient_calendar_feeds_patient"
      ON "patient_calendar_feeds" ("patientId")
    `);
    // Indici PARZIALI: dopo la revoca i token vengono azzerati, e più righe
    // revocate avrebbero tutte NULL. Un unique normale lo tollererebbe in
    // PostgreSQL, ma l'indice parziale è anche quello che serve davvero alla
    // lettura del feed, che cerca solo fra i token vivi.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_patient_calendar_feeds_token"
      ON "patient_calendar_feeds" ("token") WHERE "token" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_patient_calendar_feeds_unsub"
      ON "patient_calendar_feeds" ("unsubscribeToken") WHERE "unsubscribeToken" IS NOT NULL
    `);

    // Le migration girano come `migrator`, il backend come `*_svc`: senza
    // grant espliciti la tabella esiste ma ogni query dà permission denied.
    await queryRunner.query(`
      DO $$
      DECLARE r record;
      BEGIN
        FOR r IN SELECT rolname FROM pg_roles WHERE rolname LIKE '%\\_svc' LOOP
          EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON TABLE patient_calendar_feeds TO %I', r.rolname);
        END LOOP;
      END $$;
    `);

    // Interruttore del tenant: spento di default. Accendendolo, la mail col
    // link parte insieme al recap della prenotazione.
    await queryRunner.query(`
      ALTER TABLE "whatsapp_tenant_config"
      ADD COLUMN IF NOT EXISTS "patientCalendarFeedEnabled" boolean NOT NULL DEFAULT false
    `);

    // I template email hanno un oggetto, quelli WhatsApp no. Nullable: le
    // righe esistenti non ne hanno bisogno.
    await queryRunner.query(`
      ALTER TABLE "whatsapp_message_templates"
      ADD COLUMN IF NOT EXISTS "subjectTemplate" text
    `);

    await queryRunner.query(`COMMIT`);
    await queryRunner.query(`
      ALTER TYPE "${(queryRunner.connection.options as any).schema || 'public'}"."whatsapp_template_type_enum"
      ADD VALUE IF NOT EXISTS 'CALENDAR_INVITE_EMAIL'
    `);
    await queryRunner.query(`BEGIN`);

    await queryRunner.query(`
      INSERT INTO "whatsapp_message_templates" ("templateType", "subjectTemplate", "bodyTemplate", "isActive")
      VALUES (
        'CALENDAR_INVITE_EMAIL',
        'I suoi appuntamenti sul calendario del telefono',
        'Gentile {name},' || chr(10) || chr(10) ||
        'ecco i suoi prossimi appuntamenti:' || chr(10) || chr(10) ||
        '{appointments}' || chr(10) || chr(10) ||
        'Da questo link può aggiungerli al calendario del telefono. ' ||
        'Una volta fatto si aggiorna da solo a ogni spostamento o disdetta, senza altre email:' || chr(10) || chr(10) ||
        '{link}' || chr(10) || chr(10) ||
        'Il link è personale: le mostra i suoi appuntamenti, quindi la preghiamo di non inoltrarlo.' || chr(10) || chr(10) ||
        'Se non desidera più ricevere questo servizio può annullare l''iscrizione qui:' || chr(10) ||
        '{unsubscribe}',
        true
      )
      ON CONFLICT ("templateType") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "whatsapp_message_templates" WHERE "templateType" = 'CALENDAR_INVITE_EMAIL'
    `);
    await queryRunner.query(`
      ALTER TABLE "whatsapp_message_templates" DROP COLUMN IF EXISTS "subjectTemplate"
    `);
    await queryRunner.query(`
      ALTER TABLE "whatsapp_tenant_config" DROP COLUMN IF EXISTS "patientCalendarFeedEnabled"
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_patient_calendar_feeds_unsub"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_patient_calendar_feeds_token"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_patient_calendar_feeds_patient"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "patient_calendar_feeds"`);

    // I valori aggiunti a un enum PostgreSQL non sono rimovibili.
    console.warn("NOTA: 'CALENDAR_INVITE_EMAIL' resta nell'enum whatsapp_template_type_enum");
  }
}
