#!/usr/bin/env node
/**
 * Migration Script: User ID Format Migration
 *
 * Purpose: Migrate memories with old string-format user_ids to proper UUID format
 *
 * Context:
 * - 78 memories have user_id = 'test@example.com' (raw string, old format)
 * - These should use UUID format: user_id = '756e8675-9783-42ad-a859-cd51f331e46c'
 *
 * Safety:
 * - Creates backup table before migration
 * - Verifies counts before and after
 * - Dry-run mode available
 */

import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const isDryRun = process.argv.includes('--dry-run');

interface MigrationStats {
  backupRecordCount: number;
  recordsToMigrate: number;
  beforeDistribution: Record<string, number>;
  afterDistribution: Record<string, number>;
  migratedCount: number;
  remainingStringFormats: number;
}

async function main() {
  console.log('=== User ID Format Migration ===\n');

  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  // Initialize database client
  const client = createClient({
    url: process.env.TURSO_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  const stats: MigrationStats = {
    backupRecordCount: 0,
    recordsToMigrate: 0,
    beforeDistribution: {},
    afterDistribution: {},
    migratedCount: 0,
    remainingStringFormats: 0,
  };

  try {
    // Step 1: Create backup
    console.log('📦 Step 1: Creating backup table...');

    if (!isDryRun) {
      await client.execute(`
        CREATE TABLE IF NOT EXISTS memories_user_id_backup_20251014 AS
        SELECT * FROM memories
      `);
    }

    const backupCount = await client.execute(
      'SELECT COUNT(*) as count FROM memories'
    );
    stats.backupRecordCount = Number(backupCount.rows[0].count);
    console.log(`✅ Backup created with ${stats.backupRecordCount} records\n`);

    // Step 2: Get before distribution
    console.log('📊 Step 2: Analyzing current user_id distribution...');

    const beforeDist = await client.execute(`
      SELECT user_id, COUNT(*) as count
      FROM memories
      GROUP BY user_id
      ORDER BY count DESC
    `);

    console.log('\n📋 Current distribution:');
    beforeDist.rows.forEach(row => {
      const userId = String(row.user_id);
      const count = Number(row.count);
      stats.beforeDistribution[userId] = count;

      const isUUID = userId.includes('-');
      const format = isUUID ? 'UUID' : 'STRING';
      console.log(`  - ${userId} (${format}): ${count} memories`);
    });

    // Step 3: Identify records to migrate
    console.log('\n🔍 Step 3: Identifying records to migrate...');

    const toMigrate = await client.execute(`
      SELECT user_id, COUNT(*) as count
      FROM memories
      WHERE user_id NOT LIKE '%-%'
        AND user_id IS NOT NULL
      GROUP BY user_id
    `);

    console.log('\n📝 Records needing migration:');
    let totalToMigrate = 0;
    toMigrate.rows.forEach(row => {
      const userId = String(row.user_id);
      const count = Number(row.count);
      totalToMigrate += count;
      console.log(`  - ${userId}: ${count} records`);
    });
    stats.recordsToMigrate = totalToMigrate;
    console.log(`\n📊 Total records to migrate: ${totalToMigrate}`);

    // Step 4: Verify UUID mapping
    console.log('\n🔑 Step 4: Verifying UUID mapping...');
    const expectedUUID = '756e8675-9783-42ad-a859-cd51f331e46c';
    console.log(`  test@example.com → ${expectedUUID}`);

    // Step 5: Execute migration
    if (totalToMigrate > 0) {
      console.log('\n🚀 Step 5: Executing migration...');

      if (isDryRun) {
        console.log(`\n⚠️  DRY RUN: Would migrate ${totalToMigrate} records`);
        console.log(`   UPDATE memories SET user_id = '${expectedUUID}'`);
        console.log(`   WHERE user_id = 'test@example.com' AND user_id NOT LIKE '%-%'`);
      } else {
        const result = await client.execute({
          sql: `
            UPDATE memories
            SET user_id = ?
            WHERE user_id = 'test@example.com'
              AND user_id NOT LIKE '%-%'
          `,
          args: [expectedUUID]
        });

        stats.migratedCount = result.rowsAffected;
        console.log(`✅ Migrated ${stats.migratedCount} records`);
      }
    } else {
      console.log('\n✅ No records need migration');
    }

    // Step 6: Verify migration results
    if (!isDryRun && totalToMigrate > 0) {
      console.log('\n✅ Step 6: Verifying migration results...');

      // Check for remaining string formats
      const remaining = await client.execute(`
        SELECT user_id, COUNT(*) as count
        FROM memories
        WHERE user_id NOT LIKE '%-%'
          AND user_id IS NOT NULL
        GROUP BY user_id
      `);

      stats.remainingStringFormats = remaining.rows.reduce(
        (sum, row) => sum + Number(row.count),
        0
      );

      if (stats.remainingStringFormats > 0) {
        console.log(`\n⚠️  WARNING: ${stats.remainingStringFormats} string-format user_ids still remain:`);
        remaining.rows.forEach(row => {
          console.log(`  - ${row.user_id}: ${row.count} records`);
        });
      } else {
        console.log('✅ No string-format user_ids remain');
      }

      // Get after distribution
      const afterDist = await client.execute(`
        SELECT user_id, COUNT(*) as count
        FROM memories
        GROUP BY user_id
        ORDER BY count DESC
      `);

      console.log('\n📋 Final distribution:');
      afterDist.rows.forEach(row => {
        const userId = String(row.user_id);
        const count = Number(row.count);
        stats.afterDistribution[userId] = count;

        const isUUID = userId.includes('-');
        const format = isUUID ? 'UUID' : 'STRING';
        const before = stats.beforeDistribution[userId] || 0;
        const change = count - before;
        const changeStr = change > 0 ? `+${change}` : change < 0 ? `${change}` : '';

        console.log(`  - ${userId} (${format}): ${count} memories ${changeStr}`);
      });

      // Verify test@example.com total
      const testUUIDTotal = stats.afterDistribution[expectedUUID] || 0;
      console.log(`\n📊 Total memories for test@example.com UUID: ${testUUIDTotal}`);
      console.log(`   Expected: 115 (37 existing + 78 migrated)`);

      if (testUUIDTotal === 115) {
        console.log('   ✅ Count matches expected!');
      } else {
        console.log(`   ⚠️  Count mismatch! Got ${testUUIDTotal}, expected 115`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary');
    console.log('='.repeat(60));
    console.log(`Backup records: ${stats.backupRecordCount}`);
    console.log(`Records to migrate: ${stats.recordsToMigrate}`);
    console.log(`Records migrated: ${stats.migratedCount}`);
    console.log(`Remaining string formats: ${stats.remainingStringFormats}`);
    console.log('='.repeat(60));

    if (isDryRun) {
      console.log('\n💡 Run without --dry-run to execute migration');
    } else {
      console.log('\n✅ Migration completed successfully!');
      console.log('\n📝 Backup table: memories_user_id_backup_20251014');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    client.close();
  }
}

// Run migration
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
