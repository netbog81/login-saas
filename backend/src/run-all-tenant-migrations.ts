import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../typeorm.config';

/**
 * Esegue tutte le migrazioni TypeORM pendenti su TUTTI gli schemi tenant
 * (convenzione: schema_name LIKE 't_%').
 *
 * Uso:
 *   npx ts-node src/run-all-tenant-migrations.ts                    # fail-fast (default)
 *   npx ts-node src/run-all-tenant-migrations.ts --continue-on-error
 *   npx ts-node src/run-all-tenant-migrations.ts --dry-run           # elenca schemi senza applicare
 *
 * Flusso per ogni schema trovato:
 *   1. apre un DataSource dedicato con schema=<schema_name>
 *   2. SET search_path TO "<schema_name>" (per creazione enum/type)
 *   3. runMigrations() (applica solo le pendenti, idempotente)
 *   4. destroy() della connessione
 *
 * Riepilogo finale: numero di schemi processati, successi, fallimenti,
 * elenco migrazioni applicate.
 */

interface Flags {
  continueOnError: boolean;
  dryRun: boolean;
}

function parseFlags(argv: string[]): Flags {
  return {
    continueOnError: argv.includes('--continue-on-error'),
    dryRun: argv.includes('--dry-run'),
  };
}

async function listTenantSchemas(): Promise<string[]> {
  // Usa una connessione temporanea allo schema pubblico solo per elencare
  // gli schemi tenant. Non esegue migrazioni.
  const listingDataSource = new DataSource({
    ...(dataSourceOptions as any),
    migrationsRun: false,
    synchronize: false,
    logging: false,
  });

  await listingDataSource.initialize();
  try {
    const rows: Array<{ schema_name: string }> = await listingDataSource.query(
      `SELECT schema_name
       FROM information_schema.schemata
       WHERE schema_name LIKE 't\\_%' ESCAPE '\\'
       ORDER BY schema_name ASC`,
    );
    return rows.map((r) => r.schema_name);
  } finally {
    await listingDataSource.destroy();
  }
}

async function runMigrationsOnSchema(
  schemaName: string,
  dryRun: boolean,
): Promise<{ applied: string[]; skipped: boolean }> {
  const tenantDataSource = new DataSource({
    ...(dataSourceOptions as any),
    schema: schemaName,
    migrationsRun: false,
    synchronize: false,
    logging: false,
  });

  await tenantDataSource.initialize();

  try {
    await tenantDataSource.query(`SET search_path TO "${schemaName}"`);

    if (dryRun) {
      // showMigrations ritorna un boolean in TypeORM. Per elenco dettagliato
      // in dry-run, usiamo una query alla tabella migrations dello schema.
      const hasPending = await tenantDataSource.showMigrations();
      if (!hasPending) {
        return { applied: [], skipped: true };
      }
      // Non applichiamo niente in dry-run
      return { applied: ['<pending — dry run>'], skipped: false };
    }

    const migrations = await tenantDataSource.runMigrations();
    return {
      applied: migrations.map((m) => m.name),
      skipped: migrations.length === 0,
    };
  } finally {
    if (tenantDataSource.isInitialized) {
      await tenantDataSource.destroy();
    }
  }
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));

  console.log('\n=== Multi-tenant migration runner ===');
  console.log(`  continue-on-error: ${flags.continueOnError}`);
  console.log(`  dry-run:           ${flags.dryRun}`);
  console.log('');

  let schemas: string[];
  try {
    schemas = await listTenantSchemas();
  } catch (err) {
    console.error('Errore nel listing degli schemi tenant:', err);
    process.exit(1);
  }

  if (schemas.length === 0) {
    console.log("Nessuno schema tenant (prefisso 't_') trovato nel database.");
    console.log('Niente da fare.\n');
    process.exit(0);
  }

  console.log(`Trovati ${schemas.length} schemi tenant:`);
  for (const s of schemas) {
    console.log(`  - ${s}`);
  }
  console.log('');

  const successes: Array<{ schema: string; applied: string[]; skipped: boolean }> = [];
  const failures: Array<{ schema: string; error: any }> = [];

  for (const schemaName of schemas) {
    const label = flags.dryRun ? '[DRY-RUN]' : '[RUN]';
    console.log(`\n${label} Schema: ${schemaName}`);
    try {
      const result = await runMigrationsOnSchema(schemaName, flags.dryRun);
      successes.push({ schema: schemaName, ...result });

      if (result.skipped) {
        console.log('  Nessuna migrazione pendente.');
      } else {
        console.log(`  ${result.applied.length} migrazione/i:`);
        for (const name of result.applied) {
          console.log(`    - ${name}`);
        }
      }
    } catch (err: any) {
      failures.push({ schema: schemaName, error: err });
      console.error(`  Errore: ${err?.message || err}`);

      if (!flags.continueOnError) {
        console.error(
          '\nFail-fast attivo: interruzione. Usa --continue-on-error per processare tutti gli schemi.',
        );
        printSummary(successes, failures, schemas.length, flags);
        process.exit(1);
      }
    }
  }

  printSummary(successes, failures, schemas.length, flags);
  process.exit(failures.length > 0 ? 1 : 0);
}

function printSummary(
  successes: Array<{ schema: string; applied: string[]; skipped: boolean }>,
  failures: Array<{ schema: string; error: any }>,
  total: number,
  flags: Flags,
): void {
  console.log('\n=== Riepilogo ===');
  console.log(`  Schemi totali:     ${total}`);
  console.log(`  Processati OK:     ${successes.length}`);
  console.log(`  Falliti:           ${failures.length}`);

  const withMigrations = successes.filter((s) => !s.skipped);
  const skipped = successes.filter((s) => s.skipped);
  console.log(`  Con migrazioni:    ${withMigrations.length}`);
  console.log(`  Già aggiornati:    ${skipped.length}`);

  if (failures.length > 0) {
    console.log('\nSchemi falliti:');
    for (const f of failures) {
      console.log(`  - ${f.schema}: ${f.error?.message || f.error}`);
    }
  }

  if (flags.dryRun) {
    console.log('\n(dry-run: nessuna modifica al database)');
  }
  console.log('');
}

main().catch((err) => {
  console.error('Errore inatteso:', err);
  process.exit(1);
});
