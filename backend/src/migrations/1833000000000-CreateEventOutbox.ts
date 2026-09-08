import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Outbox degli eventi in uscita.
 *
 * Finora un evento esisteva solo in memoria fra il commit della transazione
 * e l'ack del broker: broker irraggiungibile (o backend riavviato in quella
 * finestra) = evento perso, con un `[OUTBOX-MISSING]` nei log e nient'altro.
 * Su una `treatment.closed` significa una prestazione che non arriva mai
 * alla fatturazione, e nessuno se ne accorge finché non manca la fattura.
 *
 * Da qui in avanti l'evento viene scritto in tabella e pubblicato subito
 * dopo; se il publish fallisce la riga resta `pending` e la riprende il
 * worker con backoff. Sopravvive al riavvio del backend.
 *
 * I GRANT servono: tabella nuova, e le migration girano come utente diverso
 * dal runtime.
 */
export class CreateEventOutbox1833000000000 implements MigrationInterface {
  name = 'CreateEventOutbox1833000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "event_outbox" (
        "id"            uuid NOT NULL DEFAULT gen_random_uuid(),
        "eventId"       uuid NOT NULL,
        "eventType"     varchar(100) NOT NULL,
        "tenantAlias"   varchar(100) NOT NULL,
        "correlationId" varchar(100),
        "payload"       jsonb NOT NULL,
        "status"        varchar(20) NOT NULL DEFAULT 'pending',
        "attempts"      integer NOT NULL DEFAULT 0,
        "nextAttemptAt" timestamptz NOT NULL DEFAULT now(),
        "lastError"     text,
        "sentAt"        timestamptz,
        "createdAt"     timestamptz NOT NULL DEFAULT now(),
        "updatedAt"     timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_event_outbox" PRIMARY KEY ("id")
      )
    `);

    // Chiave di idempotenza: lo stesso evento non entra due volte.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_event_outbox_event_id"
      ON "event_outbox" ("eventId")
    `);

    // È la query del worker: i pendenti maturi, in ordine di scadenza.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_event_outbox_pending"
      ON "event_outbox" ("status", "nextAttemptAt")
    `);

    await queryRunner.query(`
      DO $$
      DECLARE r record;
      BEGIN
        FOR r IN SELECT rolname FROM pg_roles WHERE rolname LIKE '%\\_svc' LOOP
          EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON TABLE event_outbox TO %I', r.rolname);
        END LOOP;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_event_outbox_pending"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_event_outbox_event_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "event_outbox"`);
  }
}
