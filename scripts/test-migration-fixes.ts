#!/usr/bin/env tsx
/**
 * Test script to validate migration fixes
 * Tests the column existence check and composite index creation
 */

import { createClient } from '@libsql/client';
import { config } from 'dotenv';

config();

const TURSO_URL = process.env.TURSO_URL!;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN!;

if (!TURSO_URL || !TURSO_AUTH_TOKEN) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

async function testMigrationFixes() {
  const db = createClient({
    url: TURSO_URL,
    authToken: TURSO_AUTH_TOKEN,
  });

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  MIGRATION FIXES VALIDATION');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Test 1: Check column existence detection
    console.log('🧪 Test 1: Column existence check logic');
    const columnCheck = await db.execute(
      `SELECT name FROM pragma_table_info('users') WHERE name = 'api_key_hash'`
    );
    const columnExists = columnCheck.rows.length > 0;
    console.log(`   Users table has api_key_hash column: ${columnExists ? '✅ Yes' : '⚠️  No'}`);

    // Test 2: Check for old api_key column
    const oldColumnCheck = await db.execute(
      `SELECT name FROM pragma_table_info('users') WHERE name = 'api_key'`
    );
    const oldColumnExists = oldColumnCheck.rows.length > 0;
    console.log(`   Users table has old api_key column: ${oldColumnExists ? '⚠️  Yes' : '✅ No'}`);

    // Test 3: Check composite indexes
    console.log('\n🧪 Test 2: Composite index verification');
    const compositeIndexes = await db.execute(`
      SELECT name
      FROM sqlite_master
      WHERE type='index'
      AND name IN ('idx_memories_user_type', 'idx_memories_user_importance')
    `);
    console.log(`   Found ${compositeIndexes.rows.length}/2 composite indexes`);

    const expectedIndexes = ['idx_memories_user_type', 'idx_memories_user_importance'];
    const foundIndexes = compositeIndexes.rows.map((r: any) => r.name);

    for (const expectedIndex of expectedIndexes) {
      const exists = foundIndexes.includes(expectedIndex);
      console.log(`   - ${expectedIndex}: ${exists ? '✅ Found' : '⚠️  Missing'}`);
    }

    // Test 4: Verify ALTER TABLE syntax pattern
    console.log('\n🧪 Test 3: ALTER TABLE syntax pattern validation');
    const testSql = 'ALTER TABLE users ADD COLUMN api_key_hash TEXT';
    const columnNameMatch = testSql.match(/ADD COLUMN (\w+)/);
    const tableNameMatch = testSql.match(/ALTER TABLE (\w+)/);

    if (columnNameMatch && tableNameMatch) {
      console.log(`   ✅ Pattern matched: table=${tableNameMatch[1]}, column=${columnNameMatch[1]}`);
    } else {
      console.log('   ❌ Pattern matching failed');
    }

    // Test 5: Check all required indexes from schema
    console.log('\n🧪 Test 4: All schema indexes verification');
    const allIndexes = await db.execute(`
      SELECT name, tbl_name
      FROM sqlite_master
      WHERE type='index'
      AND name LIKE 'idx_%'
      ORDER BY tbl_name, name
    `);

    console.log(`   Found ${allIndexes.rows.length} custom indexes:`);
    const indexByTable: Record<string, string[]> = {};

    for (const row of allIndexes.rows) {
      const { name, tbl_name } = row as any;
      if (!indexByTable[tbl_name]) {
        indexByTable[tbl_name] = [];
      }
      indexByTable[tbl_name].push(name);
    }

    for (const [table, indexes] of Object.entries(indexByTable)) {
      console.log(`   ${table}:`);
      for (const idx of indexes) {
        console.log(`      - ${idx}`);
      }
    }

    // Test 6: Verify no learned_patterns table
    console.log('\n🧪 Test 5: Verify learned_patterns cleanup');
    const learnedPatternsCheck = await db.execute(`
      SELECT COUNT(*) as count
      FROM sqlite_master
      WHERE type='table' AND name='learned_patterns'
    `);
    const tableExists = (learnedPatternsCheck.rows[0] as any).count > 0;
    console.log(`   learned_patterns table exists: ${tableExists ? '⚠️  Yes (should be dropped)' : '✅ No'}`);

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  VALIDATION COMPLETE');
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testMigrationFixes().catch(console.error);
