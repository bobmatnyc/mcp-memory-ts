#!/usr/bin/env node
/**
 * Verification Script: User ID Format Migration
 *
 * Purpose: Verify the user_id format migration was successful
 */

import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

async function main() {
  console.log('=== User ID Migration Verification ===\n');

  const client = createClient({
    url: process.env.TURSO_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  try {
    // Check total record count
    const totalCount = await client.execute('SELECT COUNT(*) as count FROM memories');
    const total = Number(totalCount.rows[0].count);
    console.log(`📊 Total memories in database: ${total}\n`);

    // Check user_id distribution
    const distribution = await client.execute(`
      SELECT user_id, COUNT(*) as count
      FROM memories
      GROUP BY user_id
      ORDER BY count DESC
    `);

    console.log('📋 User ID Distribution:');
    console.log('─'.repeat(80));
    distribution.rows.forEach(row => {
      const userId = String(row.user_id);
      const count = Number(row.count);
      const isUUID = userId.includes('-');
      const format = isUUID ? '✅ UUID' : '❌ STRING';

      console.log(`${format.padEnd(10)} | ${userId.padEnd(50)} | ${count.toString().padStart(5)} memories`);
    });
    console.log('─'.repeat(80));

    // Check for any remaining string format user_ids
    const stringFormats = await client.execute(`
      SELECT COUNT(*) as count
      FROM memories
      WHERE user_id NOT LIKE '%-%'
        AND user_id IS NOT NULL
    `);
    const stringCount = Number(stringFormats.rows[0].count);

    console.log(`\n🔍 String-format user_ids remaining: ${stringCount}`);

    if (stringCount === 0) {
      console.log('✅ SUCCESS: All user_ids are in UUID format!\n');
    } else {
      console.log('❌ FAILURE: Some string-format user_ids still exist!\n');

      const remaining = await client.execute(`
        SELECT user_id, COUNT(*) as count
        FROM memories
        WHERE user_id NOT LIKE '%-%'
          AND user_id IS NOT NULL
        GROUP BY user_id
      `);

      console.log('⚠️  Remaining string-format user_ids:');
      remaining.rows.forEach(row => {
        console.log(`  - ${row.user_id}: ${row.count} records`);
      });
      console.log();
    }

    // Verify test@example.com UUID count
    const testUUID = '756e8675-9783-42ad-a859-cd51f331e46c';
    const testCount = await client.execute({
      sql: 'SELECT COUNT(*) as count FROM memories WHERE user_id = ?',
      args: [testUUID]
    });
    const testTotal = Number(testCount.rows[0].count);

    console.log(`📊 test@example.com (UUID: ${testUUID})`);
    console.log(`   Total memories: ${testTotal}`);
    console.log(`   Expected: 115 (37 existing + 78 migrated)`);

    if (testTotal === 115) {
      console.log('   ✅ Count matches expected!\n');
    } else {
      console.log(`   ⚠️  Count mismatch! Got ${testTotal}, expected 115\n`);
    }

    // Check backup table exists
    const backupCheck = await client.execute(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='memories_user_id_backup_20251014'
    `);

    if (backupCheck.rows.length > 0) {
      const backupCount = await client.execute(
        'SELECT COUNT(*) as count FROM memories_user_id_backup_20251014'
      );
      const backupTotal = Number(backupCount.rows[0].count);
      console.log(`📦 Backup table exists: memories_user_id_backup_20251014`);
      console.log(`   Backup records: ${backupTotal}\n`);
    } else {
      console.log('⚠️  Backup table not found!\n');
    }

    // Final summary
    console.log('═'.repeat(80));
    if (stringCount === 0 && testTotal === 115) {
      console.log('✅ MIGRATION VERIFICATION: PASSED');
    } else {
      console.log('❌ MIGRATION VERIFICATION: FAILED');
    }
    console.log('═'.repeat(80));

  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    throw error;
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
