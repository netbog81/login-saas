import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migrazione 2/2: Popola dati nel sistema app_users.
 * - Migra operatori esistenti -> app_users
 * - Seed ruoli base (system)
 * - Seed permessi base
 * - Associazioni role -> permissions
 *
 * Separata dalla migrazione struttura (1771000000000) per evitare
 * problemi TypeORM con DDL + DML nella stessa migrazione.
 */
export class SeedAppUsersData1771000000001 implements MigrationInterface {
  name = 'SeedAppUsersData1771000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Seeding app_users data...');

    // 1. Migra operatori esistenti in app_users
    const operators = await queryRunner.query(`
      SELECT id, name, surname, email, phone, "isActive", "createdAt", "updatedAt"
      FROM operators
      WHERE app_user_id IS NULL
    `);

    if (operators.length > 0) {
      console.log(`  1/4 Migrating ${operators.length} operators to app_users...`);
      for (const op of operators) {
        const result = await queryRunner.query(`
          INSERT INTO app_users (name, surname, email, phone, user_type, is_active, created_at, updated_at)
          VALUES ($1, $2, $3, $4, 'operator', $5, $6, $7)
          RETURNING id
        `, [op.name, op.surname, op.email, op.phone, op.isActive, op.createdAt, op.updatedAt]);
        await queryRunner.query(
          `UPDATE operators SET app_user_id = $1 WHERE id = $2`,
          [result[0].id, op.id],
        );
      }
      console.log(`    Migrated ${operators.length} operators`);
    } else {
      console.log('  1/4 No operators to migrate');
    }

    // 2. Seed ruoli base
    console.log('  2/4 Seeding roles...');
    const roles = [
      { name: 'admin', description: 'Amministratore del tenant', isSystem: true },
      { name: 'medico', description: 'Medico - accesso agenda, pazienti, referti', isSystem: true },
      { name: 'infermiere', description: 'Infermiere - accesso agenda, pazienti', isSystem: true },
      { name: 'operatore', description: 'Operatore generico - reception, accettazione', isSystem: true },
      { name: 'segreteria', description: 'Segreteria - gestione appuntamenti e fatturazione', isSystem: true },
      { name: 'responsabile_privacy', description: 'Responsabile privacy / DPO', isSystem: true },
      { name: 'it_manager', description: 'IT Manager - gestione tenant e integrazioni', isSystem: true },
    ];

    for (const role of roles) {
      await queryRunner.query(`
        INSERT INTO roles (name, description, is_system)
        VALUES ($1, $2, $3)
        ON CONFLICT (name) DO NOTHING
      `, [role.name, role.description, role.isSystem]);
    }

    // 3. Seed permessi base
    console.log('  3/4 Seeding permissions...');
    const permissions = [
      { name: 'patient_read', resourceType: 'patient', action: 'read', description: 'Visualizzare pazienti' },
      { name: 'patient_write', resourceType: 'patient', action: 'write', description: 'Modificare pazienti' },
      { name: 'patient_delete', resourceType: 'patient', action: 'delete', description: 'Eliminare pazienti' },
      { name: 'calendar_read', resourceType: 'calendar', action: 'read', description: 'Visualizzare calendario' },
      { name: 'calendar_manage', resourceType: 'calendar', action: 'manage', description: 'Gestire appuntamenti' },
      { name: 'treatment_read', resourceType: 'treatment', action: 'read', description: 'Visualizzare trattamenti' },
      { name: 'treatment_create', resourceType: 'treatment', action: 'create', description: 'Creare trattamenti' },
      { name: 'treatment_write', resourceType: 'treatment', action: 'write', description: 'Modificare trattamenti' },
      { name: 'operator_read', resourceType: 'operator', action: 'read', description: 'Visualizzare operatori' },
      { name: 'operator_manage', resourceType: 'operator', action: 'manage', description: 'Gestire operatori' },
      { name: 'user_manage', resourceType: 'user', action: 'manage', description: 'Gestire utenti e ruoli' },
      { name: 'settings_manage', resourceType: 'settings', action: 'manage', description: 'Gestire impostazioni' },
      { name: 'reports_view', resourceType: 'reports', action: 'read', description: 'Visualizzare report' },
      { name: 'availability_manage', resourceType: 'availability', action: 'manage', description: 'Gestire disponibilita' },
      { name: 'phi_access', resourceType: 'phi', action: 'read', description: 'Accesso dati sensibili (PHI)' },
    ];

    for (const perm of permissions) {
      await queryRunner.query(`
        INSERT INTO permissions (name, resource_type, action, description)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (name) DO NOTHING
      `, [perm.name, perm.resourceType, perm.action, perm.description]);
    }

    // 4. Associazioni role -> permissions
    console.log('  4/4 Seeding role-permission associations...');
    const rolePermissions: Record<string, string[]> = {
      admin: [
        'patient_read', 'patient_write', 'patient_delete',
        'calendar_read', 'calendar_manage',
        'treatment_read', 'treatment_create', 'treatment_write',
        'operator_read', 'operator_manage',
        'user_manage', 'settings_manage', 'reports_view',
        'availability_manage', 'phi_access',
      ],
      medico: [
        'patient_read', 'patient_write',
        'calendar_read', 'calendar_manage',
        'treatment_read', 'treatment_create', 'treatment_write',
        'operator_read', 'reports_view', 'phi_access',
      ],
      infermiere: [
        'patient_read', 'patient_write',
        'calendar_read', 'calendar_manage',
        'treatment_read', 'treatment_write',
        'operator_read',
      ],
      operatore: [
        'patient_read',
        'calendar_read', 'calendar_manage',
        'treatment_read',
        'operator_read',
      ],
      segreteria: [
        'patient_read', 'patient_write',
        'calendar_read', 'calendar_manage',
        'operator_read', 'reports_view',
      ],
      responsabile_privacy: [
        'patient_read', 'phi_access',
        'user_manage', 'reports_view', 'settings_manage',
      ],
      it_manager: [
        'user_manage', 'settings_manage',
        'operator_read', 'operator_manage',
        'reports_view',
      ],
    };

    for (const [roleName, permNames] of Object.entries(rolePermissions)) {
      for (const permName of permNames) {
        await queryRunner.query(`
          INSERT INTO role_permissions (role_id, permission_id)
          SELECT r.id, p.id
          FROM roles r, permissions p
          WHERE r.name = $1 AND p.name = $2
          ON CONFLICT DO NOTHING
        `, [roleName, permName]);
      }
    }

    console.log('app_users data seeded successfully!');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('Rolling back app_users data...');

    // Rimuovi associazioni
    await queryRunner.query(`DELETE FROM role_permissions`);
    await queryRunner.query(`DELETE FROM user_roles`);

    // Rimuovi seed data
    await queryRunner.query(`DELETE FROM permissions`);
    await queryRunner.query(`DELETE FROM roles`);

    // Scollega operatori da app_users
    await queryRunner.query(`UPDATE operators SET app_user_id = NULL WHERE app_user_id IS NOT NULL`);

    // Rimuovi app_users creati dalla migrazione operatori
    await queryRunner.query(`DELETE FROM app_users WHERE user_type = 'operator'`);

    console.log('Rollback complete!');
  }
}
