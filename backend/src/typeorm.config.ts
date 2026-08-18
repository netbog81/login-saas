import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

config();

/**
 * DataSource usato SOLO dalla CLI delle migration (`npm run migration:*`).
 * A runtime l'applicazione non passa di qui: apre una connessione per tenant
 * con credenziali prese da OpenBao.
 *
 * Il database va indicato esplicitamente con MIGRATION_DB. Prima si ricadeva su
 * `DB_DATABASE`, che in .env vale `calendar_db`: un database LEGACY fermo a 79
 * migration, su cui un `migration:run` distratto ne applicherebbe una sessantina
 * tutte insieme. Meglio fermarsi con un errore parlante che indovinare.
 *
 *   MIGRATION_DB=clinico_<hash> npm run migration:show
 */
const database = process.env.MIGRATION_DB;

if (!database) {
  throw new Error(
    'MIGRATION_DB non impostata: indica il database del tenant su cui applicare le migration.\n' +
      '  Esempio: MIGRATION_DB=clinico_4701c4aaba73713294696ae7ae46d21b npm run migration:show\n' +
      "  L'elenco dei database: docker exec postgres-agenda psql -U postgres -lqt",
  );
}

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.MIGRATOR_DB_USERNAME || 'migrator',
  password: process.env.MIGRATOR_DB_PASSWORD || 'migrator',
  database,
  entities: [join(__dirname, '**/*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations/*.{ts,js}')],
  synchronize: false,
  logging: true,
});
