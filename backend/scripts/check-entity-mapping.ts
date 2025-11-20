// scripts/check-entity-mapping.ts
import { AppDataSource } from '../src/data-source';

async function checkEntityMapping() {
  await AppDataSource.initialize();

  try {
    console.log('🔍 Checking Entity ↔ Table Mapping...\n');

    // 1. Tabelle nel database
    const dbTables = await AppDataSource.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('📊 Database Tables:');
    dbTables.forEach((table: any) => console.log(`   - ${table.table_name}`));

    // 2. Entities in TypeORM
    const entities = AppDataSource.entityMetadatas;
    
    console.log('\n🏷️  TypeORM Entities:');
    entities.forEach(entity => {
      console.log(`   - ${entity.name} → Table: "${entity.tableName}"`);
    });

    // 3. Trova mismatch
    console.log('\n⚠️  Potential Mismatches:');
    let hasMismatches = false;
    
    entities.forEach(entity => {
      const dbTableExists = dbTables.some((t: any) => t.table_name === entity.tableName);
      if (!dbTableExists) {
        console.log(`   ❌ ${entity.name} maps to "${entity.tableName}" but table doesn't exist`);
        hasMismatches = true;
      } else {
        console.log(`   ✅ ${entity.name} → "${entity.tableName}"`);
      }
    });

    if (!hasMismatches) {
      console.log('\n🎉 All entities are properly mapped to database tables!');
    } else {
      console.log('\n🔧 Solution: Add table names to @Entity() decorators:');
      console.log('   @Entity("exact_table_name")');
    }

  } catch (error) {
    console.error('Error during mapping check:', error);
  } finally {
    await AppDataSource.destroy();
  }
}

checkEntityMapping();