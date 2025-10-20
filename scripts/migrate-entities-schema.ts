/**
 * Migration script to add missing columns to entities table
 *
 * This fixes the "no such column: importance" error by adding all missing
 * fields that are defined in schema.ts but not present in the database.
 *
 * Usage:
 *   npm run migrate:entities
 *
 * Or with dry-run:
 *   npm run migrate:entities -- --dry-run
 */

import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config();

const isDryRun = process.argv.includes('--dry-run');

async function migrateEntitiesSchema() {
  const client = createClient({
    url: process.env.TURSO_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  console.log('\n🔧 Entities Table Schema Migration');
  console.log('═══════════════════════════════════');
  console.log(`Mode: ${isDryRun ? '🔍 DRY RUN (no changes will be made)' : '✍️  LIVE EXECUTION'}\n`);

  try {
    // First, check which columns already exist
    console.log('📊 Checking current table structure...\n');
    const tableInfo = await client.execute('PRAGMA table_info(entities)');
    const existingColumns = new Set(
      tableInfo.rows.map((row: any) => row.name)
    );

    console.log('Existing columns:', Array.from(existingColumns).join(', '));
    console.log('');

    // Define the columns we need to add
    const columnsToAdd = [
      { name: 'importance', sql: 'ALTER TABLE entities ADD COLUMN importance INTEGER DEFAULT 2' },
      { name: 'website', sql: 'ALTER TABLE entities ADD COLUMN website TEXT' },
      { name: 'social_media', sql: 'ALTER TABLE entities ADD COLUMN social_media TEXT' },
      { name: 'relationships', sql: 'ALTER TABLE entities ADD COLUMN relationships TEXT' },
      { name: 'last_interaction', sql: 'ALTER TABLE entities ADD COLUMN last_interaction TEXT' },
      { name: 'interaction_count', sql: 'ALTER TABLE entities ADD COLUMN interaction_count INTEGER DEFAULT 0' },
    ];

    // Check which columns are missing
    const missingColumns = columnsToAdd.filter(col => !existingColumns.has(col.name));

    if (missingColumns.length === 0) {
      console.log('✅ All columns already exist! No migration needed.\n');
      return;
    }

    console.log(`Found ${missingColumns.length} missing column(s):\n`);
    missingColumns.forEach(col => {
      console.log(`  ❌ ${col.name}`);
    });
    console.log('');

    if (isDryRun) {
      console.log('📋 Migration plan (DRY RUN - not executing):\n');
      missingColumns.forEach((col, idx) => {
        console.log(`${idx + 1}. ${col.sql}`);
      });
      console.log('\n🔍 Dry run complete. Run without --dry-run to apply changes.\n');
      return;
    }

    // Execute migrations
    console.log('🚀 Executing migrations...\n');

    for (const col of missingColumns) {
      try {
        await client.execute(col.sql);
        console.log(`✅ Added column: ${col.name}`);
      } catch (error: any) {
        if (error.message.includes('duplicate column name')) {
          console.log(`⚠️  Column ${col.name} already exists, skipping`);
        } else {
          throw error;
        }
      }
    }

    // Create/update index for importance
    console.log('\n📑 Creating indexes...\n');
    try {
      await client.execute(`
        CREATE INDEX IF NOT EXISTS idx_entities_user_importance
        ON entities(user_id, importance DESC)
      `);
      console.log('✅ Created/verified idx_entities_user_importance');
    } catch (error: any) {
      console.log(`⚠️  Index creation warning: ${error.message}`);
    }

    // Update schema version
    console.log('\n📝 Updating schema version...\n');
    await client.execute(`
      INSERT OR REPLACE INTO schema_version (version, applied_at)
      VALUES (2, datetime('now'))
    `);
    console.log('✅ Schema version updated to 2');

    // Verify the migration
    console.log('\n🔍 Verifying migration...\n');
    const verifyTableInfo = await client.execute('PRAGMA table_info(entities)');
    const updatedColumns = new Set(
      verifyTableInfo.rows.map((row: any) => row.name)
    );

    const stillMissing = missingColumns.filter(col => !updatedColumns.has(col.name));

    if (stillMissing.length === 0) {
      console.log('✅ All columns verified successfully!\n');
      console.log('📊 Final column list:', Array.from(updatedColumns).join(', '));
      console.log('\n✨ Migration completed successfully!\n');
    } else {
      console.error('❌ Verification failed! Still missing columns:');
      stillMissing.forEach(col => console.error(`   - ${col.name}`));
      console.log('');
      throw new Error('Migration verification failed');
    }

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    throw error;
  } finally {
    client.close();
  }
}

// Run migration
migrateEntitiesSchema().catch((error) => {
  console.error('\n💥 Fatal error during migration:', error);
  process.exit(1);
});
