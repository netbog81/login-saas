/**
 * Script standalone per eseguire le migration su un DB tenant del clinico.
 *
 * Usage:
 *   npx ts-node scripts/run-migration.ts <tenantAlias>
 *   npx ts-node scripts/run-migration.ts bdq
 *   npx ts-node scripts/run-migration.ts bdq --check   # solo elenco pendenti, non esegue
 *   OPENBAO_ADDR=http://10.0.0.5:8203 npx ts-node scripts/run-migration.ts demo4
 *
 * OPENBAO_ADDR di default punta all'agent proxy del clinico (porta 8203,
 * systemd openbao-agent-clinico): è l'agent che ha la policy per leggere
 * tenant-clinico-db. NON usare 8200 (agent main app, policy diversa → 403).
 *
 * Risolve il tenant via OpenBao come fa il runtime (KV tenant-clinico-db +
 * database/static-creds), apre una DataSource e chiama runMigrations().
 *
 * A differenza dell'omologo accounting, le migration NON sono registrate a
 * mano: vengono caricate via glob da src/migrations/ (stesso pattern
 * dell'app.module), quindi le nuove migration sono incluse automaticamente.
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { join } from 'path';

interface TenantInfo {
  dbHost: string;
  dbPort: number;
  dbName: string;
  dbUsername: string;
  dbPassword: string;
}

async function resolveTenant(alias: string, openbaoAddr: string): Promise<TenantInfo> {
  // 1. Risolvi DB info (stessa KV del runtime: tenant-clinico-db/<alias>)
  const kvUrl = `${openbaoAddr}/v1/kv/data/tenant-clinico-db/${encodeURIComponent(alias)}`;
  const kvRes = await fetch(kvUrl);
  if (!kvRes.ok) {
    throw new Error(`OpenBao KV lookup failed for "${alias}": HTTP ${kvRes.status}`);
  }
  const kvBody = await kvRes.json() as { data?: { data?: Record<string, string> } };
  const data = kvBody?.data?.data;
  if (!data) {
    throw new Error(`Tenant "${alias}" not found in OpenBao KV`);
  }

  const dbHost = data.db_host;
  const dbPort = parseInt(data.db_port, 10) || 5432;
  const dbName = data.db_name;
  const dbUsername = data.db_username;

  // 2. Risolvi password via static-creds
  const credsUrl = `${openbaoAddr}/v1/database/static-creds/postgres-${dbUsername}`;
  const credsRes = await fetch(credsUrl);
  if (!credsRes.ok) {
    throw new Error(`OpenBao static-creds lookup failed for "${dbUsername}": HTTP ${credsRes.status}`);
  }
  const credsBody = await credsRes.json() as { data?: { password?: string; username?: string } };
  const dbPassword = credsBody?.data?.password;
  if (!dbPassword) {
    throw new Error(`Password not found for "${dbUsername}"`);
  }

  return { dbHost, dbPort, dbName, dbUsername, dbPassword };
}

async function main() {
  const tenantAlias = process.argv[2];
  if (!tenantAlias) {
    console.error('Usage: ts-node run-migration.ts <tenantAlias> [--check]');
    process.exit(1);
  }
  const checkOnly = process.argv.includes('--check');

  const openbaoAddr = process.env.OPENBAO_ADDR || 'http://127.0.0.1:8203';

  console.log(`\n[migration] Risoluzione tenant "${tenantAlias}" via ${openbaoAddr}...`);
  const tenant = await resolveTenant(tenantAlias, openbaoAddr);
  console.log(`[migration] Tenant risolto: ${tenant.dbUsername}@${tenant.dbHost}:${tenant.dbPort}/${tenant.dbName}`);

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST_OVERRIDE || tenant.dbHost,
    port: tenant.dbPort,
    database: tenant.dbName,
    username: tenant.dbUsername,
    password: tenant.dbPassword,
    ssl: false,
    // Le migration eseguono solo up(): i metadata delle entity non servono
    entities: [],
    migrations: [join(__dirname, '../src/migrations/*.{ts,js}')],
    migrationsTableName: 'migrations',
    logging: ['error', 'warn', 'migration'],
  });

  try {
    console.log('[migration] Inizializzazione DataSource...');
    await dataSource.initialize();
    console.log('[migration] Connesso. Esecuzione migration pendenti...');

    const pending = await dataSource.showMigrations();
    if (!pending) {
      console.log('[migration] Nessuna migration pendente.');
    } else if (checkOnly) {
      const executedRows: Array<{ name: string }> = await dataSource.query(
        `SELECT name FROM migrations`,
      );
      const executedNames = new Set(executedRows.map((r) => r.name));
      const pendingNames = dataSource.migrations
        .map((m) => m.constructor.name)
        .filter((name) => !executedNames.has(name));
      console.log(`[migration] ${pendingNames.length} migration pendenti (--check: nessuna esecuzione):`);
      for (const name of pendingNames) {
        console.log(`  - ${name}`);
      }
    } else {
      const executed = await dataSource.runMigrations({ transaction: 'all' });
      console.log(`[migration] Eseguite ${executed.length} migration:`);
      for (const m of executed) {
        console.log(`  - ${m.name}`);
      }
    }
  } catch (err) {
    console.error('[migration] ERRORE:', err);
    process.exit(1);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
      console.log('[migration] DataSource chiuso.');
    }
  }
}

main();
