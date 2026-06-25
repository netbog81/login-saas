import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Aggiunge il permesso `treatment_write` al ruolo applicativo `operatore`.
 *
 * Motivazione: le mutation con cui l'operatore opera sui PROPRI trattamenti
 * — `completeTreatment`, `updateTreatment`, `reopenTreatmentByOperator`,
 * `updateTreatmentInstruments` — sono protette da
 * `@RequirePermissions('treatment_write')` + `OwnershipGuard`. Il guard di
 * ownership limita già l'operatore ai trattamenti di cui è proprietario
 * (Treatment.operatorId → Operator.appUserId), ma senza il permesso base
 * `treatment_write` l'AuthorizationGuard blocca la richiesta a monte.
 *
 * Storia: nel seed (1771000000001) e nelle migration successive
 * (1781000000001 ownership, 1781000000004 treatment_create) il permesso
 * `treatment_write` non è mai stato assegnato a `operatore`. In produzione
 * (schema-per-tenant) il grant esisteva come modifica manuale; con il
 * passaggio a DB-per-tenant (restore 2026-06-10, vedi
 * 1788000000000-AddMissingUuidDefaults) la ricostruzione del DB ha
 * riapplicato solo le migration → l'operatore è rimasto senza
 * `treatment_write` e non riusciva più a completare/chiudere i propri
 * trattamenti dal workspace operatore.
 *
 * Idempotente (`ON CONFLICT DO NOTHING`). No-op se il permesso o il ruolo
 * non esistono nel tenant.
 */
export class AddTreatmentWriteToOperatore1788000000001
  implements MigrationInterface
{
  name = 'AddTreatmentWriteToOperatore1788000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO role_permissions (role_id, permission_id)
       SELECT r.id, p.id FROM roles r, permissions p
       WHERE r.name = 'operatore' AND p.name = 'treatment_write'
       ON CONFLICT DO NOTHING`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM role_permissions
       WHERE role_id = (SELECT id FROM roles WHERE name = 'operatore')
         AND permission_id = (SELECT id FROM permissions WHERE name = 'treatment_write')`,
    );
  }
}
