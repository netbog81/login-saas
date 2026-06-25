import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ripristina i DEFAULT mancanti sulle colonne id (uuid NOT NULL) di 44
 * tabelle del DB tenant.
 *
 * Storia: dopo il restore del 2026-06-10 (passaggio schema-per-tenant →
 * DB-per-tenant) molte tabelle hanno perso il `DEFAULT gen_random_uuid()`
 * sulla PK uuid. Quando il backend insertava un record senza id (es.
 * createPatternGroup, assegnazione template a operatore) il DB risponde:
 *   null value in column "id" of relation "<table>" violates not-null constraint
 * Sintomi visti: createPatternGroup e assegnazioni template fallite dalla UI.
 *
 * La migration è idempotente: aggiunge il default solo se la colonna è priva
 * di default lato DB. Sicura da rieseguire e sicura per i tenant nuovi che
 * vengano creati con migration "pulite" (in quel caso è no-op).
 *
 * Su nuovi DB tenant: l'insert delle migration storiche includerà comunque
 * il default sin dall'inizio (vedi 1764084982842-aggiuntaGroupTemplatePattern
 * che crea pattern_groups con DEFAULT uuid_generate_v4()). Questa migration
 * serve solo a recuperare i tenant esistenti dopo restore.
 */
export class AddMissingUuidDefaults1788000000000 implements MigrationInterface {
  // Tabelle individuate via:
  //   SELECT table_name FROM information_schema.columns
  //   WHERE column_name='id' AND data_type='uuid'
  //     AND table_schema='public' AND is_nullable='NO'
  //     AND column_default IS NULL
  private static readonly TABLES = [
    'appointment_instruments',
    'appointment_logs',
    'appointment_services',
    'appointments',
    'availabilities',
    'availability_appointments',
    'availability_cache',
    'availability_exceptions',
    'availability_templates',
    'evaluation_exams',
    'evaluation_objectives',
    'evaluation_tests',
    'general_settings',
    'group_exceptions',
    'gym_exception_substitutes',
    'gym_exceptions',
    'gym_pattern_groups',
    'gym_rooms',
    'gym_schedules',
    'gym_template_patterns',
    'instrument_categories',
    'instruments',
    'objective_progress_history',
    'operator_absence_types',
    'operator_categories',
    'operators',
    'path_documents',
    'patient_anamnesis',
    'patient_evaluations',
    'pattern_groups',
    'rooms',
    'service_instruments',
    'service_invoice_prefixes',
    'service_subcategories',
    'services',
    'template_assignments',
    'template_patterns',
    'test_evaluation_history',
    'therapeutic_paths',
    'treatment_instruments',
    'treatment_invoice_lines',
    'treatment_services',
    'treatments',
    'users',
    'waiting_list_entries',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of AddMissingUuidDefaults1788000000000.TABLES) {
      // Idempotenza: applica l'ALTER solo se la colonna esiste, è uuid NOT NULL
      // e non ha già un default. Salta silenziosamente le tabelle non presenti
      // (utile se un domani qualche tabella venisse rinominata o droppata).
      const rows: Array<{ has_default: boolean; exists: boolean }> = await queryRunner.query(
        `
        SELECT
          (column_default IS NOT NULL) AS has_default,
          true AS exists
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = $1
          AND column_name = 'id'
          AND data_type = 'uuid'
        `,
        [table],
      );

      if (rows.length === 0) {
        continue;
      }
      if (rows[0].has_default) {
        continue;
      }

      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of AddMissingUuidDefaults1788000000000.TABLES) {
      // DROP DEFAULT è sicuro anche se il default non c'è.
      const rows: Array<{ exists: boolean }> = await queryRunner.query(
        `
        SELECT true AS exists
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = $1
          AND column_name = 'id'
        `,
        [table],
      );
      if (rows.length === 0) continue;

      await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "id" DROP DEFAULT`);
    }
  }
}
