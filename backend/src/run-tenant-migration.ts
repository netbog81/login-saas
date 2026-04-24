import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../typeorm.config';

/**
 * Esegue tutte le migrazioni pendenti su uno schema tenant specifico.
 *
 * Uso:
 *   npx ts-node src/run-tenant-migration.ts t_4701c4aaba73713294696ae7ae46d21b
 *
 * Crea un DataSource temporaneo con lo schema specificato,
 * esegue runMigrations() (che crea enum, type, tabelle, indici, seed)
 * e poi distrugge la connessione.
 */
async function main() {
  const schemaName = process.argv[2];

  if (!schemaName) {
    console.error('Uso: npx ts-node src/run-tenant-migration.ts <schema_name>');
    console.error('Esempio: npx ts-node src/run-tenant-migration.ts t_4701c4aaba73713294696ae7ae46d21b');
    process.exit(1);
  }

  console.log(`\nEsecuzione migrazioni sullo schema: ${schemaName}\n`);

  const tenantDataSource = new DataSource({
    ...(dataSourceOptions as any),
    schema: schemaName,
    migrationsRun: false,
    synchronize: false,
    logging: true,
  });

  try {
    await tenantDataSource.initialize();
    console.log(`Connessione stabilita, schema: ${schemaName}`);

    // Setta search_path per assicurarsi che enum/type vengano creati nello schema corretto
    await tenantDataSource.query(`SET search_path TO "${schemaName}"`);

    // transaction: 'each' per ragioni di visibilità dei DDL (vedi commento
    // in run-all-tenant-migrations.ts).
    const migrations = await tenantDataSource.runMigrations({ transaction: 'each' });

    if (migrations.length === 0) {
      console.log('\nNessuna migrazione pendente da eseguire.');
    } else {
      console.log(`\n${migrations.length} migrazione/i eseguita/e:`);
      for (const m of migrations) {
        console.log(`  - ${m.name}`);
      }
    }

    console.log('\nCompletato con successo!');
  } catch (error) {
    console.error('\nErrore durante la migrazione:', error);
    process.exit(1);
  } finally {
    if (tenantDataSource.isInitialized) {
      await tenantDataSource.destroy();
    }
  }
}

main();
