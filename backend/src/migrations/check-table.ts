import { DataSource } from 'typeorm';

async function checkTable() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'calendar_db',
    logging: false,
  });

  try {
    await dataSource.initialize();
    console.log('Database connected\n');

    // Get column information
    const result = await dataSource.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'services'
      ORDER BY ordinal_position
    `);

    console.log('Services table structure:');
    console.log('═══════════════════════════════════════════════════');
    result.forEach((col: any) => {
      console.log(`${col.column_name.padEnd(25)} | ${col.data_type.padEnd(20)} | ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'} | ${col.column_default || 'no default'}`);
    });

    console.log('\n✅ Table structure check complete!');
  } catch (error) {
    console.error('❌ Check failed:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

checkTable();