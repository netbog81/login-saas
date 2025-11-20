// scripts/recreate-check-constraints.ts
import { AppDataSource } from '../src/data-source';

async function recreateCheckConstraints() {
  await AppDataSource.initialize();
  
  try {
    console.log('🔧 RECREATING CHECK CONSTRAINTS...\n');

    // 1. Prima elimina i check esistenti
    console.log('🗑️  REMOVING EXISTING CHECKS...');
    const checksToRemove = [
      { name: 'CHK_1234567890', table: 'availability_templates' },
      { name: 'CHK_1234567891', table: 'availability_templates' },
      { name: 'CHK_1234567892', table: 'availability_appointments' }
    ];

    for (const check of checksToRemove) {
      try {
        await AppDataSource.query(`ALTER TABLE "${check.table}" DROP CONSTRAINT IF EXISTS "${check.name}"`);
        console.log(`✅ REMOVED: ${check.name}`);
      } catch (error: any) {
        console.log(`⚠️  ${check.name}: ${error.message}`);
      }
    }

    // 2. Poi ricrea con gli stessi nomi
    console.log('\n🔄 RECREATING CHECKS...');
    const checksToCreate = [
      { name: 'CHK_1234567890', table: 'availability_templates', condition: '(("dayInPattern" >= 0) AND ("dayInPattern" < "patternDuration"))' },
      { name: 'CHK_1234567891', table: 'availability_templates', condition: '("endTime" > "startTime")' },
      { name: 'CHK_1234567892', table: 'availability_appointments', condition: '("endTime" > "startTime")' }
    ];

    for (const check of checksToCreate) {
      try {
        await AppDataSource.query(`ALTER TABLE "${check.table}" ADD CONSTRAINT "${check.name}" CHECK ${check.condition}`);
        console.log(`✅ CREATED: ${check.name}`);
      } catch (error: any) {
        console.log(`❌ ${check.name}: ${error.message}`);
      }
    }

    console.log('\n🔍 Run: npm run schema:log');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await AppDataSource.destroy();
  }
}

recreateCheckConstraints();
