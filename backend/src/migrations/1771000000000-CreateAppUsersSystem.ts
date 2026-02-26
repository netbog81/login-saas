import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migrazione 1/2: Crea la struttura tabelle per il sistema app_users + RBAC.
 * Solo DDL (CREATE TABLE, ALTER TABLE, CREATE INDEX). Nessun INSERT di dati.
 */
export class CreateAppUsersSystem1771000000000 implements MigrationInterface {
  name = 'CreateAppUsersSystem1771000000000';

  private async tableExists(qr: QueryRunner, tableName: string): Promise<boolean> {
    const result = await qr.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1) as exists`,
      [tableName],
    );
    return result[0]?.exists === true;
  }

  private async columnExists(qr: QueryRunner, tableName: string, columnName: string): Promise<boolean> {
    const result = await qr.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2) as exists`,
      [tableName, columnName],
    );
    return result[0]?.exists === true;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Creating app_users system (structure only)...');

    // 1. Enum app_user_type_enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "app_user_type_enum" AS ENUM ('operator', 'secretary', 'privacy_officer', 'it_manager');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log('  1/10 app_user_type_enum created');

    // 2. Tabella app_users
    if (!(await this.tableExists(queryRunner, 'app_users'))) {
      await queryRunner.query(`
        CREATE TABLE "app_users" (
          "id" uuid NOT NULL DEFAULT gen_random_uuid(),
          "keycloak_id" varchar(255),
          "name" varchar(255) NOT NULL,
          "surname" varchar(255),
          "email" varchar(255),
          "phone" varchar(50),
          "user_type" "app_user_type_enum" NOT NULL,
          "is_active" boolean NOT NULL DEFAULT true,
          "linked_at" timestamp,
          "attributes" jsonb NOT NULL DEFAULT '{}',
          "created_at" timestamp NOT NULL DEFAULT now(),
          "updated_at" timestamp NOT NULL DEFAULT now(),
          CONSTRAINT "PK_app_users" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(`
        CREATE UNIQUE INDEX "IDX_app_users_keycloak_id"
        ON "app_users" ("keycloak_id")
        WHERE "keycloak_id" IS NOT NULL
      `);
      await queryRunner.query(`CREATE INDEX "IDX_app_users_email" ON "app_users" ("email")`);
      await queryRunner.query(`CREATE INDEX "IDX_app_users_user_type" ON "app_users" ("user_type")`);
    }
    console.log('  2/10 app_users table created');

    // 3. Tabella roles
    if (!(await this.tableExists(queryRunner, 'roles'))) {
      await queryRunner.query(`
        CREATE TABLE "roles" (
          "id" uuid NOT NULL DEFAULT gen_random_uuid(),
          "name" varchar(100) NOT NULL,
          "description" text,
          "is_system" boolean NOT NULL DEFAULT false,
          "created_at" timestamp NOT NULL DEFAULT now(),
          CONSTRAINT "PK_roles" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_roles_name" UNIQUE ("name")
        )
      `);
    }
    console.log('  3/10 roles table created');

    // 4. Tabella permissions
    if (!(await this.tableExists(queryRunner, 'permissions'))) {
      await queryRunner.query(`
        CREATE TABLE "permissions" (
          "id" uuid NOT NULL DEFAULT gen_random_uuid(),
          "name" varchar(100) NOT NULL,
          "resource_type" varchar(50),
          "action" varchar(50),
          "description" text,
          "created_at" timestamp NOT NULL DEFAULT now(),
          CONSTRAINT "PK_permissions" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_permissions_name" UNIQUE ("name")
        )
      `);
    }
    console.log('  4/10 permissions table created');

    // 5. Tabella user_roles (N:N)
    if (!(await this.tableExists(queryRunner, 'user_roles'))) {
      await queryRunner.query(`
        CREATE TABLE "user_roles" (
          "app_user_id" uuid NOT NULL,
          "role_id" uuid NOT NULL,
          "assigned_at" timestamp NOT NULL DEFAULT now(),
          CONSTRAINT "PK_user_roles" PRIMARY KEY ("app_user_id", "role_id"),
          CONSTRAINT "FK_user_roles_app_user" FOREIGN KEY ("app_user_id")
            REFERENCES "app_users"("id") ON DELETE CASCADE,
          CONSTRAINT "FK_user_roles_role" FOREIGN KEY ("role_id")
            REFERENCES "roles"("id") ON DELETE CASCADE
        )
      `);
    }
    console.log('  5/10 user_roles table created');

    // 6. Tabella role_permissions (N:N)
    if (!(await this.tableExists(queryRunner, 'role_permissions'))) {
      await queryRunner.query(`
        CREATE TABLE "role_permissions" (
          "role_id" uuid NOT NULL,
          "permission_id" uuid NOT NULL,
          "assigned_at" timestamp NOT NULL DEFAULT now(),
          CONSTRAINT "PK_role_permissions" PRIMARY KEY ("role_id", "permission_id"),
          CONSTRAINT "FK_role_permissions_role" FOREIGN KEY ("role_id")
            REFERENCES "roles"("id") ON DELETE CASCADE,
          CONSTRAINT "FK_role_permissions_permission" FOREIGN KEY ("permission_id")
            REFERENCES "permissions"("id") ON DELETE CASCADE
        )
      `);
    }
    console.log('  6/10 role_permissions table created');

    // 7. Tabella secretaries
    if (!(await this.tableExists(queryRunner, 'secretaries'))) {
      await queryRunner.query(`
        CREATE TABLE "secretaries" (
          "id" uuid NOT NULL DEFAULT gen_random_uuid(),
          "app_user_id" uuid NOT NULL,
          "department" varchar(100),
          "can_manage_appointments" boolean NOT NULL DEFAULT false,
          "can_manage_billing" boolean NOT NULL DEFAULT false,
          "created_at" timestamp NOT NULL DEFAULT now(),
          "updated_at" timestamp NOT NULL DEFAULT now(),
          CONSTRAINT "PK_secretaries" PRIMARY KEY ("id"),
          CONSTRAINT "FK_secretaries_app_user" FOREIGN KEY ("app_user_id")
            REFERENCES "app_users"("id") ON DELETE CASCADE,
          CONSTRAINT "UQ_secretaries_app_user" UNIQUE ("app_user_id")
        )
      `);
    }
    console.log('  7/10 secretaries table created');

    // 8. Tabella privacy_officers
    if (!(await this.tableExists(queryRunner, 'privacy_officers'))) {
      await queryRunner.query(`
        CREATE TABLE "privacy_officers" (
          "id" uuid NOT NULL DEFAULT gen_random_uuid(),
          "app_user_id" uuid NOT NULL,
          "certification" varchar(255),
          "certification_expiry" date,
          "dpo_registration_number" varchar(100),
          "created_at" timestamp NOT NULL DEFAULT now(),
          "updated_at" timestamp NOT NULL DEFAULT now(),
          CONSTRAINT "PK_privacy_officers" PRIMARY KEY ("id"),
          CONSTRAINT "FK_privacy_officers_app_user" FOREIGN KEY ("app_user_id")
            REFERENCES "app_users"("id") ON DELETE CASCADE,
          CONSTRAINT "UQ_privacy_officers_app_user" UNIQUE ("app_user_id")
        )
      `);
    }
    console.log('  8/10 privacy_officers table created');

    // 9. Tabella it_managers
    if (!(await this.tableExists(queryRunner, 'it_managers'))) {
      await queryRunner.query(`
        CREATE TABLE "it_managers" (
          "id" uuid NOT NULL DEFAULT gen_random_uuid(),
          "app_user_id" uuid NOT NULL,
          "can_manage_tenant" boolean NOT NULL DEFAULT true,
          "can_manage_integrations" boolean NOT NULL DEFAULT true,
          "notes" text,
          "created_at" timestamp NOT NULL DEFAULT now(),
          "updated_at" timestamp NOT NULL DEFAULT now(),
          CONSTRAINT "PK_it_managers" PRIMARY KEY ("id"),
          CONSTRAINT "FK_it_managers_app_user" FOREIGN KEY ("app_user_id")
            REFERENCES "app_users"("id") ON DELETE CASCADE,
          CONSTRAINT "UQ_it_managers_app_user" UNIQUE ("app_user_id")
        )
      `);
    }
    console.log('  9/10 it_managers table created');

    // 10. Aggiunge app_user_id a operators
    if (!(await this.columnExists(queryRunner, 'operators', 'app_user_id'))) {
      await queryRunner.query(`ALTER TABLE "operators" ADD COLUMN "app_user_id" uuid`);
      await queryRunner.query(`
        ALTER TABLE "operators"
        ADD CONSTRAINT "FK_operators_app_user"
        FOREIGN KEY ("app_user_id") REFERENCES "app_users"("id") ON DELETE SET NULL
      `);
      await queryRunner.query(`
        CREATE UNIQUE INDEX "IDX_operators_app_user_id"
        ON "operators" ("app_user_id")
        WHERE "app_user_id" IS NOT NULL
      `);
    }
    console.log('  10/10 app_user_id added to operators');

    console.log('app_users structure created successfully!');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('Rolling back app_users structure...');

    if (await this.columnExists(queryRunner, 'operators', 'app_user_id')) {
      await queryRunner.query(`DROP INDEX IF EXISTS "IDX_operators_app_user_id"`);
      await queryRunner.query(`ALTER TABLE "operators" DROP CONSTRAINT IF EXISTS "FK_operators_app_user"`);
      await queryRunner.query(`ALTER TABLE "operators" DROP COLUMN "app_user_id"`);
    }

    await queryRunner.query(`DROP TABLE IF EXISTS "role_permissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_roles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "it_managers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "privacy_officers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "secretaries"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "permissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "roles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "app_users"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "app_user_type_enum"`);

    console.log('Rollback complete!');
  }
}
