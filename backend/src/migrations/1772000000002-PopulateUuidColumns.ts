import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migrazione 2/3: Popolamento colonne UUID (data mapping).
 *
 * Genera UUID per le PK e mappa le FK integer → UUID via JOIN.
 * Operazione esclusivamente DML (UPDATE), nessuna modifica strutturale.
 *
 * Forward-Compatible:
 * - Nessun nome di schema hardcoded
 * - public.uuid_generate_v4() per compatibilità cross-schema
 */
export class PopulateUuidColumns1772000000002 implements MigrationInterface {
  name = 'PopulateUuidColumns1772000000002';

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
    console.log('=== Migrazione 2/3: Popolamento colonne UUID ===');

    // --- Popolare uuid_id sulle tabelle PK ---
    const pkTables = ['patients', 'users', 'persone_riferimento', 'paziente_persona_relazioni', 'appointments', 'availabilities'];

    for (const table of pkTables) {
      if ((await this.tableExists(queryRunner, table)) && (await this.columnExists(queryRunner, table, 'uuid_id'))) {
        await queryRunner.query(`UPDATE "${table}" SET "uuid_id" = public.uuid_generate_v4() WHERE "uuid_id" IS NULL`);
        console.log(`  ${table}: uuid_id popolato`);
      }
    }

    // --- Mappare FK integer → UUID via JOIN ---

    // FK verso patients (oldCol integer → newCol uuid tramite patients.uuid_id)
    const patientFKs: Array<{ table: string; oldCol: string; newCol: string }> = [
      { table: 'availability_appointments', oldCol: 'patientId', newCol: 'patient_uuid' },
      { table: 'treatments', oldCol: 'patientId', newCol: 'patient_uuid' },
      { table: 'therapeutic_paths', oldCol: 'patientId', newCol: 'patient_uuid' },
      { table: 'appointment_logs', oldCol: 'patientId', newCol: 'patient_uuid' },
      { table: 'appointments', oldCol: 'patientId', newCol: 'patient_uuid' },
    ];

    for (const fk of patientFKs) {
      if ((await this.tableExists(queryRunner, fk.table)) && (await this.columnExists(queryRunner, fk.table, fk.oldCol)) && (await this.columnExists(queryRunner, fk.table, fk.newCol))) {
        await queryRunner.query(`
          UPDATE "${fk.table}" t SET "${fk.newCol}" = p."uuid_id"
          FROM "patients" p WHERE t."${fk.oldCol}" = p."id"
        `);
        console.log(`  ${fk.table}.${fk.oldCol} → ${fk.newCol} mappato`);
      }
    }

    // patient_anamnesis ha colonna con nome diverso (patient_id)
    if ((await this.tableExists(queryRunner, 'patient_anamnesis')) && (await this.columnExists(queryRunner, 'patient_anamnesis', 'patient_id')) && (await this.columnExists(queryRunner, 'patient_anamnesis', 'patient_uuid'))) {
      await queryRunner.query(`
        UPDATE "patient_anamnesis" pa SET "patient_uuid" = p."uuid_id"
        FROM "patients" p WHERE pa."patient_id" = p."id"
      `);
      console.log('  patient_anamnesis.patient_id → patient_uuid mappato');
    }

    // persone_riferimento: paziente_id, coniuge_paziente_id → patients
    if (await this.tableExists(queryRunner, 'persone_riferimento')) {
      const prPatientFKs: Array<{ oldCol: string; newCol: string }> = [
        { oldCol: 'paziente_id', newCol: 'paziente_uuid' },
        { oldCol: 'coniuge_paziente_id', newCol: 'coniuge_paziente_uuid' },
      ];
      for (const fk of prPatientFKs) {
        if ((await this.columnExists(queryRunner, 'persone_riferimento', fk.oldCol)) && (await this.columnExists(queryRunner, 'persone_riferimento', fk.newCol))) {
          await queryRunner.query(`
            UPDATE "persone_riferimento" pr SET "${fk.newCol}" = p."uuid_id"
            FROM "patients" p WHERE pr."${fk.oldCol}" = p."id"
          `);
          console.log(`  persone_riferimento.${fk.oldCol} → ${fk.newCol} mappato`);
        }
      }

      // creato_da_utente_id, modificato_da_utente_id → users
      const prUserFKs: Array<{ oldCol: string; newCol: string }> = [
        { oldCol: 'creato_da_utente_id', newCol: 'creato_da_utente_uuid' },
        { oldCol: 'modificato_da_utente_id', newCol: 'modificato_da_utente_uuid' },
      ];
      for (const fk of prUserFKs) {
        if ((await this.columnExists(queryRunner, 'persone_riferimento', fk.oldCol)) && (await this.columnExists(queryRunner, 'persone_riferimento', fk.newCol))) {
          await queryRunner.query(`
            UPDATE "persone_riferimento" pr SET "${fk.newCol}" = u."uuid_id"
            FROM "users" u WHERE pr."${fk.oldCol}" = u."id"
          `);
          console.log(`  persone_riferimento.${fk.oldCol} → ${fk.newCol} mappato`);
        }
      }
    }

    // paziente_persona_relazioni
    if (await this.tableExists(queryRunner, 'paziente_persona_relazioni')) {
      // paziente_id → patients
      if ((await this.columnExists(queryRunner, 'paziente_persona_relazioni', 'paziente_id')) && (await this.columnExists(queryRunner, 'paziente_persona_relazioni', 'paziente_uuid'))) {
        await queryRunner.query(`
          UPDATE "paziente_persona_relazioni" ppr SET "paziente_uuid" = p."uuid_id"
          FROM "patients" p WHERE ppr."paziente_id" = p."id"
        `);
        console.log('  paziente_persona_relazioni.paziente_id → paziente_uuid mappato');
      }

      // persona_riferimento_id → persone_riferimento
      if ((await this.columnExists(queryRunner, 'paziente_persona_relazioni', 'persona_riferimento_id')) && (await this.columnExists(queryRunner, 'paziente_persona_relazioni', 'persona_riferimento_uuid'))) {
        await queryRunner.query(`
          UPDATE "paziente_persona_relazioni" ppr SET "persona_riferimento_uuid" = pr."uuid_id"
          FROM "persone_riferimento" pr WHERE ppr."persona_riferimento_id" = pr."id"
        `);
        console.log('  paziente_persona_relazioni.persona_riferimento_id → persona_riferimento_uuid mappato');
      }

      // creato_da_utente_id, consenso_raccolto_da_utente_id → users
      const pprUserFKs: Array<{ oldCol: string; newCol: string }> = [
        { oldCol: 'creato_da_utente_id', newCol: 'creato_da_utente_uuid' },
        { oldCol: 'consenso_raccolto_da_utente_id', newCol: 'consenso_raccolto_da_utente_uuid' },
      ];
      for (const fk of pprUserFKs) {
        if ((await this.columnExists(queryRunner, 'paziente_persona_relazioni', fk.oldCol)) && (await this.columnExists(queryRunner, 'paziente_persona_relazioni', fk.newCol))) {
          await queryRunner.query(`
            UPDATE "paziente_persona_relazioni" ppr SET "${fk.newCol}" = u."uuid_id"
            FROM "users" u WHERE ppr."${fk.oldCol}" = u."id"
          `);
          console.log(`  paziente_persona_relazioni.${fk.oldCol} → ${fk.newCol} mappato`);
        }
      }
    }

    // --- FK verso users ---

    // availabilities.userId → users
    if ((await this.tableExists(queryRunner, 'availabilities')) && (await this.columnExists(queryRunner, 'availabilities', 'userId')) && (await this.columnExists(queryRunner, 'availabilities', 'user_uuid'))) {
      await queryRunner.query(`
        UPDATE "availabilities" av SET "user_uuid" = u."uuid_id"
        FROM "users" u WHERE av."userId" = u."id"
      `);
      console.log('  availabilities.userId → user_uuid mappato');
    }

    // operators.userId, legacyUserId → users
    if (await this.tableExists(queryRunner, 'operators')) {
      const opUserFKs: Array<{ oldCol: string; newCol: string }> = [
        { oldCol: 'userId', newCol: 'user_uuid' },
        { oldCol: 'legacyUserId', newCol: 'legacy_user_uuid' },
      ];
      for (const fk of opUserFKs) {
        if ((await this.columnExists(queryRunner, 'operators', fk.oldCol)) && (await this.columnExists(queryRunner, 'operators', fk.newCol))) {
          await queryRunner.query(`
            UPDATE "operators" o SET "${fk.newCol}" = u."uuid_id"
            FROM "users" u WHERE o."${fk.oldCol}" = u."id"
          `);
          console.log(`  operators.${fk.oldCol} → ${fk.newCol} mappato`);
        }
      }
    }

    console.log('=== Migrazione 2/3 completata ===');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('=== Rollback Migrazione 2/3: Azzeramento colonne UUID ===');

    // SET NULL su tutte le colonne uuid temporanee
    // I dati generati non sono reversibili deterministicamente
    const columnsToNull: Array<{ table: string; column: string }> = [
      // PK tables
      { table: 'patients', column: 'uuid_id' },
      { table: 'users', column: 'uuid_id' },
      { table: 'persone_riferimento', column: 'uuid_id' },
      { table: 'paziente_persona_relazioni', column: 'uuid_id' },
      { table: 'appointments', column: 'uuid_id' },
      { table: 'availabilities', column: 'uuid_id' },
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
    ];

    for (const col of columnsToNull) {
      if ((await this.tableExists(queryRunner, col.table)) && (await this.columnExists(queryRunner, col.table, col.column))) {
        await queryRunner.query(`UPDATE "${col.table}" SET "${col.column}" = NULL`);
      }
    }

    console.log('=== Rollback Migrazione 2/3 completato ===');
  }
}
