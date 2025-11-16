import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'calendar_db',
    logging: true,
  });

  try {
    await dataSource.initialize();
    console.log('Database connected');

    // Read migration file
    const migrationPath = path.join(__dirname, 'update-service-fields.migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // Split SQL statements by semicolon and filter empty statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    // Execute each statement
    for (const statement of statements) {
      console.log(`\nExecuting: ${statement.substring(0, 50)}...`);
      try {
        await dataSource.query(statement);
        console.log('✓ Success');
      } catch (error: any) {
        if (error.message.includes('already exists')) {
          console.log('⚠ Column already exists, skipping...');
        } else {
          console.error('✗ Error:', error.message);
        }
      }
    }

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

runMigration();