import { DataSource } from 'typeorm';

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

    // Add description column
    console.log('Adding description column...');
    await dataSource.query('ALTER TABLE services ADD COLUMN IF NOT EXISTS description TEXT');
    console.log('✓ Description column added successfully');

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

runMigration();