import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Refactor "big bang" per integrazione col Curandis Registry.
 *
 * - Droppa TUTTE le FK fisiche verso `patients` (query dinamica perché i nomi
 *   FK dipendono da hash TypeORM, variabile per installazione).
 * - Estende `patient_anamnesis`:
 *     - rinomina `patient_id` → `subject_id` (UUID = subjectId del registry)
 *     - rinomina indice `IDX_patient_anamnesis_patient` → `IDX_patient_anamnesis_subject`
 *     - aggiunge `gruppo_sanguigno`, `medico_base`, `patologie_croniche`
 * - Droppa `paziente_persona_relazioni`, `persone_riferimento`, `patients` + tutti gli enum.
 * - Crea le 4 tabelle nuove:
 *     - `clinical_subject_index`
 *     - `clinical_attendance_log` (+ enum)
 *     - `clinical_relationship_extension`
 *     - `processed_registry_events`
 *
 * IMPORTANTE: i dati esistenti nelle 3 tabelle paziente vengono PERSI.
 * I 3700 pazienti reali sono già nel registry; i dati clinici locali sono di test.
 *
 * down() non implementato: la migrazione è irreversibile by design.
 */
export class RegistryIntegrationDropPatientsAndCreateIndex1782000000000
  implements MigrationInterface
{
  name = 'RegistryIntegrationDropPatientsAndCreateIndex1782000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Forza il search_path al "current schema" della connection per assicurare
    // che tutti gli ALTER/CREATE/DROP non qualificati vadano nello schema corretto
    // (le migrazioni girano sia in `public` per i tenant non multi-tenant,
    // sia negli schemi `t_<hash>` per i tenant multi-schema).
    const currentSchema = (await queryRunner.query('SELECT current_schema() AS s'))[0].s;
    await queryRunner.query(`SET LOCAL search_path TO "${currentSchema}"`);

    // ========================================================================
    // 0. TRUNCATE dati paziente-correlati.
    // L'utente ha confermato: dati di test, perdibili. Il registry sarà la
    // source-of-truth da qui in poi. Manteniamo intatto:
    //   - users, operators (e correlati: operator_categories, services,
    //     operator_services, instruments, instrument_categories, rooms,
    //     gym_rooms, gym_*, availability_templates, template_patterns,
    //     pattern_groups, template_assignments, availability_exceptions,
    //     group_exceptions, availabilities, availability_cache, settings,
    //     service_invoice_prefixes, service_subcategories, ...)
    //
    // Il TRUNCATE CASCADE svuota anche tutte le FK dipendenti in transitivo.
    // ========================================================================
    await queryRunner.query(`
      TRUNCATE TABLE
        appointments,
        availability_appointments,
        appointment_logs,
        appointment_services,
        appointment_instruments,
        treatments,
        treatment_services,
        treatment_instruments,
        treatment_invoice_lines,
        therapeutic_paths,
        path_documents,
        patient_evaluations,
        evaluation_objectives,
        evaluation_tests,
        evaluation_exams,
        objective_progress_history,
        test_evaluation_history,
        patient_anamnesis,
        waiting_list_entries
      RESTART IDENTITY CASCADE;
    `);

    // ========================================================================
    // 1. Drop FK fisiche verso `patients` su tutte le tabelle dipendenti.
    // Query dinamica: trova ogni constraint che referenzia patients.id e droppalo.
    // ========================================================================
    await queryRunner.query(`
      DO $$
      DECLARE
        r record;
        cur_schema text := current_schema();
      BEGIN
        FOR r IN
          SELECT tc.table_schema, tc.table_name, tc.constraint_name
          FROM information_schema.referential_constraints rc
          JOIN information_schema.table_constraints tc
            ON tc.constraint_name = rc.constraint_name
           AND tc.constraint_schema = rc.constraint_schema
          JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = rc.unique_constraint_name
           AND ccu.constraint_schema = rc.unique_constraint_schema
          WHERE ccu.table_name = 'patients'
            AND ccu.table_schema = cur_schema
            AND tc.table_schema = cur_schema
        LOOP
          EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I',
                         r.table_schema, r.table_name, r.constraint_name);
        END LOOP;
      END $$;
    `);

    // ========================================================================
    // 2. patient_anamnesis: rename + 3 nuovi campi
    // ========================================================================
    // Rinomina la colonna (e droppa il vecchio indice / lo ricrea sul nuovo nome).
    // Niente prefix schema: search_path è già stato impostato sul current_schema().
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_patient_anamnesis_patient"`);
    await queryRunner.query(
      `ALTER TABLE "patient_anamnesis" RENAME COLUMN "patient_id" TO "subject_id"`,
    );
    // Indice unique sul nuovo nome (era unique nella vecchia entity → resta unique).
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_patient_anamnesis_subject" ON "patient_anamnesis" ("subject_id")`,
    );

    // Aggiunge i 3 campi nuovi (consolidando ciò che oggi sta su Patient).
    await queryRunner.query(
      `ALTER TABLE "patient_anamnesis" ADD COLUMN "gruppo_sanguigno" character varying(5)`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_anamnesis" ADD COLUMN "medico_base" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_anamnesis" ADD COLUMN "patologie_croniche" text`,
    );

    // ========================================================================
    // 3. Drop tabelle vecchie pazienti + persone riferimento + relazioni
    // ========================================================================
    await queryRunner.query(`DROP TABLE IF EXISTS "paziente_persona_relazioni" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "persone_riferimento" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "patients" CASCADE`);

    // ========================================================================
    // 4. Drop enum legati alle tabelle eliminate
    // ========================================================================
    await queryRunner.query(`DROP TYPE IF EXISTS "patients_genere_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "patients_stato_civile_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "patients_tipo_paziente_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "patients_stato_anagrafica_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "patients_stato_privacy_enum"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "persone_riferimento_genere_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "persone_riferimento_stato_civile_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "persone_riferimento_tipo_riferimento_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "persone_riferimento_tipo_patria_podesta_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "persone_riferimento_stato_relazione_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "paziente_persona_relazioni_tipo_trattamento_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "paziente_persona_relazioni_tipo_consenso_richiesto_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "paziente_persona_relazioni_stato_consenso_enum"`,
    );

    // ========================================================================
    // 5. clinical_subject_index — cache lookup registry
    // ========================================================================
    await queryRunner.query(`
      CREATE TABLE "clinical_subject_index" (
        "subject_id" uuid PRIMARY KEY,
        "organization_id" uuid NOT NULL,
        "display_name" text,
        "display_name_lower" text,
        "tax_code_hash" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "stale" boolean NOT NULL DEFAULT false,
        "last_synced_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_csi_display_name_lower" ON "clinical_subject_index" ("display_name_lower")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_csi_org_active" ON "clinical_subject_index" ("organization_id", "is_active")`,
    );

    // ========================================================================
    // 6. clinical_attendance_log — audit no-show / cancellazioni
    // ========================================================================
    await queryRunner.query(`
      CREATE TYPE "clinical_attendance_log_event_type_enum"
        AS ENUM ('NO_SHOW', 'CANCELLATION')
    `);
    await queryRunner.query(`
      CREATE TABLE "clinical_attendance_log" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "subject_id" uuid NOT NULL,
        "event_type" "clinical_attendance_log_event_type_enum" NOT NULL,
        "occurred_at" timestamptz NOT NULL,
        "year" int NOT NULL,
        "reason" text,
        "operator_id" uuid,
        "appointment_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_attendance_subject_year" ON "clinical_attendance_log" ("subject_id", "year")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_attendance_subject_type" ON "clinical_attendance_log" ("subject_id", "event_type")`,
    );

    // ========================================================================
    // 7. clinical_relationship_extension — flag operativi sulle relationships del registry
    // ========================================================================
    await queryRunner.query(`
      CREATE TABLE "clinical_relationship_extension" (
        "registry_relationship_id" uuid PRIMARY KEY,
        "organization_id" uuid NOT NULL,
        "is_emergency_contact" boolean NOT NULL DEFAULT false,
        "is_authorized_pickup" boolean NOT NULL DEFAULT false,
        "is_caregiver_during_visits" boolean NOT NULL DEFAULT false,
        "notes" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_cre_org" ON "clinical_relationship_extension" ("organization_id")`,
    );

    // ========================================================================
    // 8. processed_registry_events — idempotency consumer RabbitMQ
    // ========================================================================
    await queryRunner.query(`
      CREATE TABLE "processed_registry_events" (
        "event_id" uuid PRIMARY KEY,
        "event_type" text NOT NULL,
        "subject_id" uuid,
        "tenant_alias" text,
        "processed_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_pre_processed_at" ON "processed_registry_events" ("processed_at")`,
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Migrazione irreversibile: i dati delle vecchie tabelle paziente sono
    // andati persi, non c'è modo di ricrearle in modo sensato.
    throw new Error(
      'Migration RegistryIntegrationDropPatientsAndCreateIndex1782000000000 non è reversibile. ' +
        'Per rollback: ripristinare un dump pg_dump precedente alla migrazione.',
    );
  }
}
