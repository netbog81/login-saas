import { DataSource } from 'typeorm';

async function checkServices() {
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

    // Count total services
    const totalCount = await dataSource.query('SELECT COUNT(*) as count FROM services');
    console.log(`Total services in database: ${totalCount[0].count}`);

    // Get all services
    const services = await dataSource.query(`
      SELECT id, name, "isActive", "defaultDuration", "defaultPrice",
             "bufferTimeBefore", "bufferTimeAfter", description, color
      FROM services
      ORDER BY "createdAt" DESC
    `);

    if (services.length === 0) {
      console.log('\n❌ No services found in the database');
    } else {
      console.log('\n📋 Services in database:');
      console.log('═══════════════════════════════════════════════════════════════════');
      services.forEach((service: any) => {
        console.log(`ID: ${service.id}`);
        console.log(`Name: ${service.name}`);
        console.log(`Active: ${service.isActive ? '✅ YES' : '❌ NO'}`);
        console.log(`Duration: ${service.defaultDuration} min`);
        console.log(`Price: €${service.defaultPrice}`);
        console.log(`Buffer Before: ${service.bufferTimeBefore} min`);
        console.log(`Buffer After: ${service.bufferTimeAfter} min`);
        console.log(`Description: ${service.description || 'N/A'}`);
        console.log(`Color: ${service.color || 'N/A'}`);
        console.log('───────────────────────────────────────────────────────────────────');
      });
    }

    // Count active vs inactive
    const activeCount = await dataSource.query('SELECT COUNT(*) as count FROM services WHERE "isActive" = true');
    const inactiveCount = await dataSource.query('SELECT COUNT(*) as count FROM services WHERE "isActive" = false');

    console.log('\n📊 Summary:');
    console.log(`Active services: ${activeCount[0].count}`);
    console.log(`Inactive services: ${inactiveCount[0].count}`);

  } catch (error) {
    console.error('❌ Check failed:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

checkServices();