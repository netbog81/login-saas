import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migrazione 3/3: Swap colonne integer → UUID e ricreazione vincoli.
 *
 * Drop constraints/indexes sulle colonne integer, swap colonne
 * (drop old integer, rename uuid temp → nome originale),
 * ricreazione PK, FK, indexes.
 *
 * Forward-Compatible:
 * - Nessun nome di schema hardcoded
 * - Ricerca dinamica constraints via information_schema
 * - public.uuid_generate_v4() per DEFAULT delle nuove PK
 */
export class SwapIntegerToUuidPKs1772000000003 implements MigrationInterface {
  name = 'SwapIntegerToUuidPKs1772000000003';

  // ==================== HELPERS ====================

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

  /**
   * Drop tutte le FK constraints su una colonna (ricerca dinamica)
   */
  private async dropFKsOnColumn(qr: QueryRunner, table: string, column: string): Promise<void> {
    const fks = await qr.query(`
      SELECT tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_name = $1
        AND kcu.column_name = $2
        AND tc.constraint_type = 'FOREIGN KEY'
    `, [table, column]);
    for (const fk of fks) {
      await qr.query(`ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${fk.constraint_name}"`);
    }
  }

  /**
   * Drop la PK constraint su una tabella (ricerca dinamica)
   */
  private async dropPK(qr: QueryRunner, table: string): Promise<void> {
    const pks = await qr.query(`
      SELECT tc.constraint_name
      FROM information_schema.table_constraints tc
      WHERE tc.table_name = $1
        AND tc.constraint_type = 'PRIMARY KEY'
    `, [table]);
    for (const pk of pks) {
      await qr.query(`ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${pk.constraint_name}"`);
    }
  }

  /**
   * Drop tutti gli index su una colonna (non-PK)
   */
  private async dropIndexesOnColumn(qr: QueryRunner, table: string, column: string): Promise<void> {
    const indexes = await qr.query(`
      SELECT i.relname AS index_name
      FROM pg_index ix
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      WHERE t.relname = $1
        AND a.attname = $2
        AND NOT ix.indisprimary
        AND NOT ix.indisunique
    `, [table, column]);
    for (const idx of indexes) {
      await qr.query(`DROP INDEX IF EXISTS "${idx.index_name}"`);
    }
  }

  /**
   * Drop tutte le UNIQUE constraints che coinvolgono una colonna
   */
  private async dropUniqueConstraintsOnColumn(qr: QueryRunner, table: string, column: string): Promise<void> {
    const constraints = await qr.query(`
      SELECT tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_name = $1
        AND kcu.column_name = $2
        AND tc.constraint_type = 'UNIQUE'
    `, [table, column]);
    for (const c of constraints) {
      await qr.query(`ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${c.constraint_name}"`);
    }
  }

  // ==================== MAIN MIGRATION ====================

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('=== Migrazione 3/3: Swap colonne integer → UUID e vincoli ===');

    const pkTables = ['patients', 'users', 'persone_riferimento', 'paziente_persona_relazioni', 'appointments', 'availabilities'];

    // ==================== FASE 1: DROP constraints e indexes ====================
    console.log('Fase 1: DROP FK constraints, PK constraints, indexes...');

    // Drop FK su colonne integer (sia outbound che inbound)
    const allFKsToDrop: Array<{ table: string; column: string }> = [
      // FK verso patients
      { table: 'availability_appointments', column: 'patientId' },
      { table: 'treatments', column: 'patientId' },
      { table: 'therapeutic_paths', column: 'patientId' },
      { table: 'patient_anamnesis', column: 'patient_id' },
      { table: 'appointment_logs', column: 'patientId' },
      { table: 'appointments', column: 'patientId' },
      { table: 'persone_riferimento', column: 'paziente_id' },
      { table: 'persone_riferimento', column: 'coniuge_paziente_id' },
      { table: 'persone_riferimento', column: 'creato_da_utente_id' },
      { table: 'persone_riferimento', column: 'modificato_da_utente_id' },
      { table: 'paziente_persona_relazioni', column: 'paziente_id' },
      { table: 'paziente_persona_relazioni', column: 'persona_riferimento_id' },
      { table: 'paziente_persona_relazioni', column: 'creato_da_utente_id' },
      { table: 'paziente_persona_relazioni', column: 'consenso_raccolto_da_utente_id' },
      // FK verso users
      { table: 'availabilities', column: 'userId' },
      { table: 'operators', column: 'userId' },
      { table: 'operators', column: 'legacyUserId' },
    ];

    for (const fk of allFKsToDrop) {
      if ((await this.tableExists(queryRunner, fk.table)) && (await this.columnExists(queryRunner, fk.table, fk.column))) {
        await this.dropFKsOnColumn(queryRunner, fk.table, fk.column);
        await this.dropUniqueConstraintsOnColumn(queryRunner, fk.table, fk.column);
        await this.dropIndexesOnColumn(queryRunner, fk.table, fk.column);
      }
    }

    // Drop PK e indexes su colonne id delle tabelle PK
    for (const table of pkTables) {
      if (await this.tableExists(queryRunner, table)) {
        await this.dropFKsOnColumn(queryRunner, table, 'id');
        await this.dropUniqueConstraintsOnColumn(queryRunner, table, 'id');
        await this.dropIndexesOnColumn(queryRunner, table, 'id');
        await this.dropPK(queryRunner, table);
      }
    }

    console.log('  Constraints e indexes droppati');

    // ==================== FASE 2: Swap colonne PK ====================
    console.log('Fase 2: Swap colonne PK integer → UUID...');

    for (const table of pkTables) {
      if ((await this.tableExists(queryRunner, table)) && (await this.columnExists(queryRunner, table, 'uuid_id'))) {
        await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN "id"`);
        await queryRunner.query(`ALTER TABLE "${table}" RENAME COLUMN "uuid_id" TO "id"`);
        await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "id" SET DEFAULT public.uuid_generate_v4()`);
        await queryRunner.query(`ALTER TABLE "${table}" ADD PRIMARY KEY ("id")`);
        await queryRunner.query(`DROP SEQUENCE IF EXISTS "${table}_id_seq"`);
        console.log(`  ${table}: PK convertita a UUID`);
      }
    }

    // ==================== FASE 3: Swap colonne FK ====================
    console.log('Fase 3: Swap colonne FK integer → UUID...');

    // FK verso patients
    const patientFKSwaps: Array<{ table: string; oldCol: string; newCol: string }> = [
      { table: 'availability_appointments', oldCol: 'patientId', newCol: 'patient_uuid' },
      { table: 'treatments', oldCol: 'patientId', newCol: 'patient_uuid' },
      { table: 'therapeutic_paths', oldCol: 'patientId', newCol: 'patient_uuid' },
      { table: 'appointment_logs', oldCol: 'patientId', newCol: 'patient_uuid' },
      { table: 'appointments', oldCol: 'patientId', newCol: 'patient_uuid' },
    ];

    for (const fk of patientFKSwaps) {
      if ((await this.tableExists(queryRunner, fk.table)) && (await this.columnExists(queryRunner, fk.table, fk.oldCol)) && (await this.columnExists(queryRunner, fk.table, fk.newCol))) {
        await queryRunner.query(`ALTER TABLE "${fk.table}" DROP COLUMN "${fk.oldCol}"`);
        await queryRunner.query(`ALTER TABLE "${fk.table}" RENAME COLUMN "${fk.newCol}" TO "${fk.oldCol}"`);
        console.log(`  ${fk.table}.${fk.oldCol}: convertita a UUID`);
      }
    }

    // patient_anamnesis: patient_id
    if ((await this.tableExists(queryRunner, 'patient_anamnesis')) && (await this.columnExists(queryRunner, 'patient_anamnesis', 'patient_id')) && (await this.columnExists(queryRunner, 'patient_anamnesis', 'patient_uuid'))) {
      await queryRunner.query(`ALTER TABLE "patient_anamnesis" DROP COLUMN "patient_id"`);
      await queryRunner.query(`ALTER TABLE "patient_anamnesis" RENAME COLUMN "patient_uuid" TO "patient_id"`);
      console.log('  patient_anamnesis.patient_id: convertita a UUID');
    }

    // persone_riferimento
    if (await this.tableExists(queryRunner, 'persone_riferimento')) {
      const prSwaps: Array<{ oldCol: string; newCol: string }> = [
        { oldCol: 'paziente_id', newCol: 'paziente_uuid' },
        { oldCol: 'coniuge_paziente_id', newCol: 'coniuge_paziente_uuid' },
        { oldCol: 'creato_da_utente_id', newCol: 'creato_da_utente_uuid' },
        { oldCol: 'modificato_da_utente_id', newCol: 'modificato_da_utente_uuid' },
      ];
      for (const fk of prSwaps) {
        if ((await this.columnExists(queryRunner, 'persone_riferimento', fk.oldCol)) && (await this.columnExists(queryRunner, 'persone_riferimento', fk.newCol))) {
          await queryRunner.query(`ALTER TABLE "persone_riferimento" DROP COLUMN "${fk.oldCol}"`);
          await queryRunner.query(`ALTER TABLE "persone_riferimento" RENAME COLUMN "${fk.newCol}" TO "${fk.oldCol}"`);
          console.log(`  persone_riferimento.${fk.oldCol}: convertita a UUID`);
        }
      }
    }

    // paziente_persona_relazioni
    if (await this.tableExists(queryRunner, 'paziente_persona_relazioni')) {
      const pprSwaps: Array<{ oldCol: string; newCol: string }> = [
        { oldCol: 'paziente_id', newCol: 'paziente_uuid' },
        { oldCol: 'persona_riferimento_id', newCol: 'persona_riferimento_uuid' },
        { oldCol: 'creato_da_utente_id', newCol: 'creato_da_utente_uuid' },
        { oldCol: 'consenso_raccolto_da_utente_id', newCol: 'consenso_raccolto_da_utente_uuid' },
      ];
      for (const fk of pprSwaps) {
        if ((await this.columnExists(queryRunner, 'paziente_persona_relazioni', fk.oldCol)) && (await this.columnExists(queryRunner, 'paziente_persona_relazioni', fk.newCol))) {
          await queryRunner.query(`ALTER TABLE "paziente_persona_relazioni" DROP COLUMN "${fk.oldCol}"`);
          await queryRunner.query(`ALTER TABLE "paziente_persona_relazioni" RENAME COLUMN "${fk.newCol}" TO "${fk.oldCol}"`);
          console.log(`  paziente_persona_relazioni.${fk.oldCol}: convertita a UUID`);
        }
      }
    }

    // availabilities.userId
    if ((await this.tableExists(queryRunner, 'availabilities')) && (await this.columnExists(queryRunner, 'availabilities', 'userId')) && (await this.columnExists(queryRunner, 'availabilities', 'user_uuid'))) {
      await queryRunner.query(`ALTER TABLE "availabilities" DROP COLUMN "userId"`);
      await queryRunner.query(`ALTER TABLE "availabilities" RENAME COLUMN "user_uuid" TO "userId"`);
      console.log('  availabilities.userId: convertita a UUID');
    }

    // operators.userId, legacyUserId
    if (await this.tableExists(queryRunner, 'operators')) {
      const opSwaps: Array<{ oldCol: string; newCol: string }> = [
        { oldCol: 'userId', newCol: 'user_uuid' },
        { oldCol: 'legacyUserId', newCol: 'legacy_user_uuid' },
      ];
      for (const fk of opSwaps) {
        if ((await this.columnExists(queryRunner, 'operators', fk.oldCol)) && (await this.columnExists(queryRunner, 'operators', fk.newCol))) {
          await queryRunner.query(`ALTER TABLE "operators" DROP COLUMN "${fk.oldCol}"`);
          await queryRunner.query(`ALTER TABLE "operators" RENAME COLUMN "${fk.newCol}" TO "${fk.oldCol}"`);
          console.log(`  operators.${fk.oldCol}: convertita a UUID`);
        }
      }
    }

    // ==================== FASE 4: Ricreare FK constraints e indexes ====================
    console.log('Fase 4: Ricreare FK constraints e indexes...');

    // FK verso patients
    const patientFKConstraints: Array<{ table: string; column: string; nullable: boolean }> = [
      { table: 'availability_appointments', column: 'patientId', nullable: true },
      { table: 'treatments', column: 'patientId', nullable: true },
      { table: 'therapeutic_paths', column: 'patientId', nullable: false },
      { table: 'appointment_logs', column: 'patientId', nullable: true },
      { table: 'appointments', column: 'patientId', nullable: true },
    ];

    for (const fk of patientFKConstraints) {
      if ((await this.tableExists(queryRunner, fk.table)) && (await this.columnExists(queryRunner, fk.table, fk.column))) {
        const constraintName = `FK_${fk.table}_${fk.column}_patients`;
        await queryRunner.query(`
          ALTER TABLE "${fk.table}" ADD CONSTRAINT "${constraintName}"
          FOREIGN KEY ("${fk.column}") REFERENCES "patients"("id")
          ON DELETE ${fk.nullable ? 'SET NULL' : 'CASCADE'}
        `);
      }
    }

    // patient_anamnesis.patient_id → patients
    if ((await this.tableExists(queryRunner, 'patient_anamnesis')) && (await this.columnExists(queryRunner, 'patient_anamnesis', 'patient_id'))) {
      await queryRunner.query(`
        ALTER TABLE "patient_anamnesis" ADD CONSTRAINT "FK_patient_anamnesis_patient_id_patients"
        FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE
      `);
      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "IDX_patient_anamnesis_patient_unique" ON "patient_anamnesis" ("patient_id")
      `);
    }

    // persone_riferimento → patients
    if (await this.tableExists(queryRunner, 'persone_riferimento')) {
      if (await this.columnExists(queryRunner, 'persone_riferimento', 'paziente_id')) {
        await queryRunner.query(`
          ALTER TABLE "persone_riferimento" ADD CONSTRAINT "FK_persone_riferimento_paziente_id_patients"
          FOREIGN KEY ("paziente_id") REFERENCES "patients"("id") ON DELETE CASCADE
        `);
      }
      if (await this.columnExists(queryRunner, 'persone_riferimento', 'coniuge_paziente_id')) {
        await queryRunner.query(`
          ALTER TABLE "persone_riferimento" ADD CONSTRAINT "FK_persone_riferimento_coniuge_paziente_id_patients"
          FOREIGN KEY ("coniuge_paziente_id") REFERENCES "patients"("id") ON DELETE SET NULL
        `);
      }
    }

    // paziente_persona_relazioni → patients, persone_riferimento
    if (await this.tableExists(queryRunner, 'paziente_persona_relazioni')) {
      if (await this.columnExists(queryRunner, 'paziente_persona_relazioni', 'paziente_id')) {
        await queryRunner.query(`
          ALTER TABLE "paziente_persona_relazioni" ADD CONSTRAINT "FK_ppr_paziente_id_patients"
          FOREIGN KEY ("paziente_id") REFERENCES "patients"("id") ON DELETE CASCADE
        `);
      }
      if (await this.columnExists(queryRunner, 'paziente_persona_relazioni', 'persona_riferimento_id')) {
        await queryRunner.query(`
          ALTER TABLE "paziente_persona_relazioni" ADD CONSTRAINT "FK_ppr_persona_riferimento_id_persone_riferimento"
          FOREIGN KEY ("persona_riferimento_id") REFERENCES "persone_riferimento"("id") ON DELETE CASCADE
        `);
      }
    }

    // FK verso users
    if ((await this.tableExists(queryRunner, 'availabilities')) && (await this.columnExists(queryRunner, 'availabilities', 'userId'))) {
      await queryRunner.query(`
        ALTER TABLE "availabilities" ADD CONSTRAINT "FK_availabilities_userId_users"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      `);
    }

    // Ricreare indexes principali
    const indexesToRecreate: Array<{ table: string; column: string; name: string }> = [
      { table: 'availability_appointments', column: 'patientId', name: 'IDX_availability_appointments_patient' },
      { table: 'treatments', column: 'patientId', name: 'IDX_treatments_patient' },
      { table: 'therapeutic_paths', column: 'patientId', name: 'IDX_therapeutic_paths_patient' },
      { table: 'patient_anamnesis', column: 'patient_id', name: 'IDX_patient_anamnesis_patient' },
      { table: 'appointment_logs', column: 'patientId', name: 'IDX_appointment_logs_patient' },
    ];

    for (const idx of indexesToRecreate) {
      if ((await this.tableExists(queryRunner, idx.table)) && (await this.columnExists(queryRunner, idx.table, idx.column))) {
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "${idx.name}" ON "${idx.table}" ("${idx.column}")`);
      }
    }

    // Ricreare indexes composti per persone_riferimento
    if (await this.tableExists(queryRunner, 'persone_riferimento')) {
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_persone_riferimento_paziente_tipo" ON "persone_riferimento" ("paziente_id", "tipo_riferimento")`);
    }

    // Ricreare indexes composti e unique per paziente_persona_relazioni
    if (await this.tableExists(queryRunner, 'paziente_persona_relazioni')) {
      await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ppr_paziente_persona_unique" ON "paziente_persona_relazioni" ("paziente_id", "persona_riferimento_id")`);
      await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ppr_paziente_persona_trattamento_unique" ON "paziente_persona_relazioni" ("paziente_id", "persona_riferimento_id", "tipo_trattamento")`);
    }

    console.log('=== Migrazione 3/3 completata: Integer PK → UUID ===');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // La migrazione down non è supportata per questa conversione.
    // Una volta convertiti i PK a UUID con dati mappati, il rollback
    // richiederebbe un mapping UUID→integer che non è deterministico.
    console.warn('ATTENZIONE: Rollback della migrazione UUID non supportato.');
    console.warn('Per ripristinare, utilizzare un backup del database.');
  }
}
