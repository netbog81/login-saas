import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crea le tabelle per il sistema Task Messages (messaggistica interna tra utenti):
 * - task_message: copia locale dei messaggi/task
 * - task_message_webhook_event: eventi raw webhook per audit
 */
export class CreateTaskMessageSystem1777000000000 implements MigrationInterface {
  name = 'CreateTaskMessageSystem1777000000000';

  private async tableExists(qr: QueryRunner, tableName: string): Promise<boolean> {
    const result = await qr.query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = $1
        AND table_schema = current_schema()
      ) as "exists"`,
      [tableName],
    );
    return result[0]?.exists === true;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Creating Task Message system tables...');

    // 1. Tabella task_message
    if (!(await this.tableExists(queryRunner, 'task_message'))) {
      await queryRunner.query(`
        CREATE TABLE "task_message" (
          "id" uuid NOT NULL DEFAULT gen_random_uuid(),
          "gateway_message_id" uuid NOT NULL,
          "tenant_id" varchar(100) NOT NULL,
          "sender_user_id" uuid NOT NULL,
          "recipient_user_id" uuid NOT NULL,
          "content" text NOT NULL,
          "status" varchar(20) NOT NULL DEFAULT 'SCHEDULED',
          "available_from" timestamptz,
          "correlation_id" uuid,
          "read_at" timestamptz,
          "completed_at" timestamptz,
          "deleted_at" timestamptz,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT "PK_task_message" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_task_message_gateway_id" UNIQUE ("gateway_message_id"),
          CONSTRAINT "FK_task_message_sender" FOREIGN KEY ("sender_user_id") REFERENCES "app_users"("id") ON DELETE CASCADE,
          CONSTRAINT "FK_task_message_recipient" FOREIGN KEY ("recipient_user_id") REFERENCES "app_users"("id") ON DELETE CASCADE
        )
      `);

      await queryRunner.query(`CREATE INDEX "IDX_task_msg_tenant_recipient_status" ON "task_message" ("tenant_id", "recipient_user_id", "status")`);
      await queryRunner.query(`CREATE INDEX "IDX_task_msg_tenant_sender_status" ON "task_message" ("tenant_id", "sender_user_id", "status")`);
      await queryRunner.query(`CREATE INDEX "IDX_task_msg_gateway_id" ON "task_message" ("gateway_message_id")`);
      await queryRunner.query(`CREATE INDEX "IDX_task_msg_correlation" ON "task_message" ("correlation_id")`);
      await queryRunner.query(`CREATE INDEX "IDX_task_msg_tenant_completed" ON "task_message" ("tenant_id", "status") WHERE status = 'COMPLETED'`);
    }
    console.log('  1/2 task_message table created');

    // 2. Tabella task_message_webhook_event
    if (!(await this.tableExists(queryRunner, 'task_message_webhook_event'))) {
      await queryRunner.query(`
        CREATE TABLE "task_message_webhook_event" (
          "id" uuid NOT NULL DEFAULT gen_random_uuid(),
          "tenant_id" varchar(100) NOT NULL,
          "correlation_id" uuid,
          "event_type" varchar(100) NOT NULL,
          "raw_event" jsonb NOT NULL,
          "processed" boolean NOT NULL DEFAULT false,
          "processed_at" timestamptz,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT "PK_task_message_webhook_event" PRIMARY KEY ("id")
        )
      `);

      await queryRunner.query(`CREATE INDEX "IDX_task_webhook_tenant" ON "task_message_webhook_event" ("tenant_id")`);
      await queryRunner.query(`CREATE INDEX "IDX_task_webhook_type" ON "task_message_webhook_event" ("event_type")`);
    }
    console.log('  2/2 task_message_webhook_event table created');

    console.log('Task Message system migration completed');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "task_message_webhook_event" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "task_message" CASCADE`);
  }
}
