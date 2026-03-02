import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migrazione 1/3: Aggiunta colonne UUID temporanee (nullable).
 *
 * Crea le colonne uuid_id sulle tabelle PK e le colonne FK uuid
 * temporanee su tutte le tabelle con FK integer.
 * Le colonne vengono lasciate nullable per essere popolate nella migrazione 2.
 *
 * Forward-Compatible:
 * - Nessun nome di schema hardcoded
 * - public.uuid_generate_v4() per compatibilità cross-schema
 */
export class AddUuidColumns1772000000001 implements MigrationInterface {
  name = 'AddUuidColumns1772000000001';

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

  private async addColumnIfNotExists(qr: QueryRunner, table: string, column: string, type: string): Promise<void> {
    if ((await this.tableExists(qr, table)) && !(await this.columnExists(qr, table, column))) {
      await qr.query(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${type}`);
      console.log(`  ${table}.${column} aggiunta`);
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('=== Migrazione 1/3: Aggiunta colonne UUID temporanee ===');

    // Garantire estensione uuid-ossp (no-op se già presente, vitale per nuovi DB futuri)
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public`);

    // --- Colonne uuid_id sulle tabelle PK ---
    const pkTables = ['patients', 'users', 'persone_riferimento', 'paziente_persona_relazioni', 'appointments', 'availabilities'];

    for (const table of pkTables) {
      await this.addColumnIfNotExists(queryRunner, table, 'uuid_id', 'uuid DEFAULT public.uuid_generate_v4()');
    }

    // --- Colonne FK uuid temporanee ---

    // FK verso patients (patientId)
    const patientFKTables: Array<{ table: string; column: string }> = [
      { table: 'availability_appointments', column: 'patient_uuid' },
      { table: 'treatments', column: 'patient_uuid' },
      { table: 'therapeutic_paths', column: 'patient_uuid' },
      { table: 'patient_anamnesis', column: 'patient_uuid' },
      { table: 'appointment_logs', column: 'patient_uuid' },
      { table: 'appointments', column: 'patient_uuid' },
    ];

    for (const fk of patientFKTables) {
      await this.addColumnIfNotExists(queryRunner, fk.table, fk.column, 'uuid');
    }

    // persone_riferimento: paziente_id, coniuge_paziente_id → patients; creato_da_utente_id, modificato_da_utente_id → users
    await this.addColumnIfNotExists(queryRunner, 'persone_riferimento', 'paziente_uuid', 'uuid');
    await this.addColumnIfNotExists(queryRunner, 'persone_riferimento', 'coniuge_paziente_uuid', 'uuid');
    await this.addColumnIfNotExists(queryRunner, 'persone_riferimento', 'creato_da_utente_uuid', 'uuid');
    await this.addColumnIfNotExists(queryRunner, 'persone_riferimento', 'modificato_da_utente_uuid', 'uuid');

    // paziente_persona_relazioni: paziente_id → patients; persona_riferimento_id → persone_riferimento; creato_da_utente_id, consenso_raccolto_da_utente_id → users
    await this.addColumnIfNotExists(queryRunner, 'paziente_persona_relazioni', 'paziente_uuid', 'uuid');
    await this.addColumnIfNotExists(queryRunner, 'paziente_persona_relazioni', 'persona_riferimento_uuid', 'uuid');
    await this.addColumnIfNotExists(queryRunner, 'paziente_persona_relazioni', 'creato_da_utente_uuid', 'uuid');
    await this.addColumnIfNotExists(queryRunner, 'paziente_persona_relazioni', 'consenso_raccolto_da_utente_uuid', 'uuid');

    // FK verso users
    await this.addColumnIfNotExists(queryRunner, 'availabilities', 'user_uuid', 'uuid');
    await this.addColumnIfNotExists(queryRunner, 'operators', 'user_uuid', 'uuid');
    await this.addColumnIfNotExists(queryRunner, 'operators', 'legacy_user_uuid', 'uuid');

    console.log('=== Migrazione 1/3 completata ===');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('=== Rollback Migrazione 1/3: Rimozione colonne UUID temporanee ===');

    const columnsToDrop: Array<{ table: string; column: string }> = [
      // FK verso patients
      { table: 'availability_appointments', column: 'patient_uuid' },
      { table: 'treatments', column: 'patient_uuid' },
      { table: 'therapeutic_paths', column: 'patient_uuid' },
      { table: 'patient_anamnesis', column: 'patient_uuid' },
      { table: 'appointment_logs', column: 'patient_uuid' },
      { table: 'appointments', column: 'patient_uuid' },
      // persone_riferimento
      { table: 'persone_riferimento', column: 'paziente_uuid' },
      { table: 'persone_riferimento', column: 'coniuge_paziente_uuid' },
      { table: 'persone_riferimento', column: 'creato_da_utente_uuid' },
      { table: 'persone_riferimento', column: 'modificato_da_utente_uuid' },
      // paziente_persona_relazioni
      { table: 'paziente_persona_relazioni', column: 'paziente_uuid' },
      { table: 'paziente_persona_relazioni', column: 'persona_riferimento_uuid' },
      { table: 'paziente_persona_relazioni', column: 'creato_da_utente_uuid' },
      { table: 'paziente_persona_relazioni', column: 'consenso_raccolto_da_utente_uuid' },
      // FK verso users
      { table: 'availabilities', column: 'user_uuid' },
      { table: 'operators', column: 'user_uuid' },
      { table: 'operators', column: 'legacy_user_uuid' },
      // PK tables uuid_id
      { table: 'patients', column: 'uuid_id' },
      { table: 'users', column: 'uuid_id' },
      { table: 'persone_riferimento', column: 'uuid_id' },
      { table: 'paziente_persona_relazioni', column: 'uuid_id' },
      { table: 'appointments', column: 'uuid_id' },
      { table: 'availabilities', column: 'uuid_id' },
    ];

    for (const col of columnsToDrop) {
      if ((await this.tableExists(queryRunner, col.table)) && (await this.columnExists(queryRunner, col.table, col.column))) {
        await queryRunner.query(`ALTER TABLE "${col.table}" DROP COLUMN "${col.column}"`);
      }
    }

    console.log('=== Rollback Migrazione 1/3 completato ===');
  }
}
