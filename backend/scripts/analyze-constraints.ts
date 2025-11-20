// scripts/analyze-constraints.ts
import { AppDataSource } from '../src/data-source';

async function analyzeConstraints() {
  await AppDataSource.initialize();
  
  try {
    console.log('🔍 ANALYZING CURRENT DATABASE STATE...\n');

    // 1. FOREIGN KEYS attuali
    console.log('🗂️  CURRENT FOREIGN KEYS:');
    const foreignKeys = await AppDataSource.query(`
      SELECT 
        conname as constraint_name,
        conrelid::regclass as table_name,
        confrelid::regclass as referenced_table,
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE contype = 'f' 
      AND conname NOT LIKE 'pg_%'
      ORDER BY table_name, constraint_name
    `);
    
    foreignKeys.forEach((fk: any) => {
      console.log(`   📎 ${fk.constraint_name}`);
      console.log(`      Table: ${fk.table_name} → References: ${fk.referenced_table}`);
      console.log(`      Definition: ${fk.definition}`);
      console.log(`      ---`);
    });

    // 2. INDEXES attuali
    console.log('\n📊 CURRENT INDEXES:');
    const indexes = await AppDataSource.query(`
      SELECT 
        indexname as index_name,
        tablename as table_name,
        indexdef as definition
      FROM pg_indexes 
      WHERE schemaname = 'public'
      AND indexname NOT LIKE 'pg_%'
      ORDER BY table_name, index_name
    `);
    
    indexes.forEach((idx: any) => {
      console.log(`   🔍 ${idx.index_name}`);
      console.log(`      Table: ${idx.table_name}`);
      console.log(`      Definition: ${idx.definition}`);
      console.log(`      ---`);
    });

    // 3. CHECK CONSTRAINTS attuali
    console.log('\n✅ CURRENT CHECK CONSTRAINTS:');
    const checkConstraints = await AppDataSource.query(`
      SELECT 
        conname as constraint_name,
        conrelid::regclass as table_name,
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE contype = 'c'
      AND conname NOT LIKE 'pg_%'
      ORDER BY table_name, constraint_name
    `);
    
    checkConstraints.forEach((chk: any) => {
      console.log(`   ✓ ${chk.constraint_name}`);
      console.log(`      Table: ${chk.table_name}`);
      console.log(`      Definition: ${chk.definition}`);
      console.log(`      ---`);
    });

    // 4. UNIQUE CONSTRAINTS attuali
    console.log('\n🔐 CURRENT UNIQUE CONSTRAINTS:');
    const uniqueConstraints = await AppDataSource.query(`
      SELECT 
        conname as constraint_name,
        conrelid::regclass as table_name,
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE contype = 'u'
      AND conname NOT LIKE 'pg_%'
      ORDER BY table_name, constraint_name
    `);
    
    uniqueConstraints.forEach((uniq: any) => {
      console.log(`   🔒 ${uniq.constraint_name}`);
      console.log(`      Table: ${uniq.table_name}`);
      console.log(`      Definition: ${uniq.definition}`);
      console.log(`      ---`);
    });

    console.log('\n📈 SUMMARY:');
    console.log(`   Foreign Keys: ${foreignKeys.length}`);
    console.log(`   Indexes: ${indexes.length}`);
    console.log(`   Check Constraints: ${checkConstraints.length}`);
    console.log(`   Unique Constraints: ${uniqueConstraints.length}`);

  } catch (error) {
    console.error('❌ Error during analysis:', error);
  } finally {
    await AppDataSource.destroy();
  }
}

analyzeConstraints();
