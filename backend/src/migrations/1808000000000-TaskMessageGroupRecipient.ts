import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Messaggi task a gruppo (es. "segreteria"): una sola riga condivisa con
 * recipient_group valorizzato e recipient_user_id NULL. Tutte le segretarie
 * attive vedono il messaggio in inbox; la prima che lo completa lo fa
 * scomparire alle altre (stato condiviso sulla stessa riga).
 *
 * - recipient_user_id diventa nullable (alternativo a recipient_group)
 * - recipient_group: slug del gruppo destinatario ('secretary')
 * - read_by_user_id / completed_by_user_id: chi ha letto/eseguito il task
 *   (rilevante per i messaggi di gruppo, valorizzato anche per i singoli)
 */
export class TaskMessageGroupRecipient1808000000000 implements MigrationInterface {
  name = 'TaskMessageGroupRecipient1808000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Task Message group recipient migration...');

    await queryRunner.query(
      `ALTER TABLE "task_message" ALTER COLUMN "recipient_user_id" DROP NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "task_message" ADD COLUMN IF NOT EXISTS "recipient_group" varchar(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_message" ADD COLUMN IF NOT EXISTS "read_by_user_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_message" ADD COLUMN IF NOT EXISTS "completed_by_user_id" uuid`,
    );

    // FK con SET NULL: la cancellazione di un utente non deve cancellare lo storico task
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_task_message_read_by') THEN
          ALTER TABLE "task_message" ADD CONSTRAINT "FK_task_message_read_by"
            FOREIGN KEY ("read_by_user_id") REFERENCES "app_users"("id") ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_task_message_completed_by') THEN
          ALTER TABLE "task_message" ADD CONSTRAINT "FK_task_message_completed_by"
            FOREIGN KEY ("completed_by_user_id") REFERENCES "app_users"("id") ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_task_message_recipient') THEN
          ALTER TABLE "task_message" ADD CONSTRAINT "CHK_task_message_recipient"
            CHECK (num_nonnulls("recipient_user_id", "recipient_group") = 1);
        END IF;
      END $$;
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_task_msg_tenant_group_status"
         ON "task_message" ("tenant_id", "recipient_group", "status")
         WHERE "recipient_group" IS NOT NULL`,
    );

    console.log('Task Message group recipient migration completed');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_task_msg_tenant_group_status"`);
    await queryRunner.query(`ALTER TABLE "task_message" DROP CONSTRAINT IF EXISTS "CHK_task_message_recipient"`);
    await queryRunner.query(`ALTER TABLE "task_message" DROP CONSTRAINT IF EXISTS "FK_task_message_completed_by"`);
    await queryRunner.query(`ALTER TABLE "task_message" DROP CONSTRAINT IF EXISTS "FK_task_message_read_by"`);
    await queryRunner.query(`ALTER TABLE "task_message" DROP COLUMN IF EXISTS "completed_by_user_id"`);
    await queryRunner.query(`ALTER TABLE "task_message" DROP COLUMN IF EXISTS "read_by_user_id"`);
    // Le righe di gruppo hanno recipient_user_id NULL: vanno rimosse prima di
    // ripristinare il NOT NULL.
    await queryRunner.query(`DELETE FROM "task_message" WHERE "recipient_group" IS NOT NULL`);
    await queryRunner.query(`ALTER TABLE "task_message" DROP COLUMN IF EXISTS "recipient_group"`);
    await queryRunner.query(`ALTER TABLE "task_message" ALTER COLUMN "recipient_user_id" SET NOT NULL`);
  }
}
