import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sede predefinita.
 *
 * Il concetto mancava del tutto: `sites` aveva nome, indirizzo e `isActive`,
 * ma nessun modo di dire QUALE sede sia "quella principale". La conseguenza
 * si è vista in accounting, dove la numerazione documenti distingue fra
 * serie generale (`siteId` NULL) e serie per-sede: senza una sede eletta a
 * predefinita, la scelta ricadeva sull'operatore ogni volta, ed è così che
 * su bdq è nata una serie per-sede rimasta inerte per due mesi.
 *
 * Regola: la sede predefinita è quella che, lato contabile, usa la serie
 * GENERALE. Con una sede sola è predefinita d'ufficio — ed è il caso di
 * tutti i tenant oggi.
 *
 * L'elezione iniziale è la più anziana fra le attive: con una sede sola è
 * quella, con più sedi è comunque un default sensato che l'admin può
 * spostare dalla pagina Amministrazione → Sedi.
 */
export class AddSiteIsDefault1832000000000 implements MigrationInterface {
  name = 'AddSiteIsDefault1832000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sites"
      ADD COLUMN IF NOT EXISTS "isDefault" boolean NOT NULL DEFAULT false
    `);

    // Elezione iniziale, solo se nessuna sede è già predefinita.
    await queryRunner.query(`
      UPDATE "sites" SET "isDefault" = true
       WHERE id = (
         SELECT id FROM "sites"
          WHERE "isActive" = true
          ORDER BY "createdAt" ASC
          LIMIT 1
       )
         AND NOT EXISTS (SELECT 1 FROM "sites" WHERE "isDefault" = true)
    `);

    // Una sola predefinita per tenant: lo schema isola il tenant, quindi
    // l'indice parziale basta a garantirlo a livello di DB.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_sites_single_default"
      ON "sites" (("isDefault")) WHERE "isDefault" = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_sites_single_default"`);
    await queryRunner.query(`ALTER TABLE "sites" DROP COLUMN IF EXISTS "isDefault"`);
  }
}
