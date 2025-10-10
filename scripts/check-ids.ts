#!/usr/bin/env tsx
/**
 * Check why IDs are showing as null
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { initDatabaseFromEnv } from '../src/database/index.js';

// Load environment variables
const envLocalPath = resolve(process.cwd(), '.env.local');
const envPath = resolve(process.cwd(), '.env');

if (existsSync(envLocalPath)) {
  config({ path: envLocalPath });
} else if (existsSync(envPath)) {
  config({ path: envPath });
}

async function checkIds() {
  console.log('\n🔍 Checking Memory IDs\n');

  try {
    const db = initDatabaseFromEnv();
    await db.connect();

    // Get all column names and types
    const schemaResult = await db.execute(`
      PRAGMA table_info(memories)
    `);

    console.log('📋 Table Schema:');
    for (const col of schemaResult.rows as any[]) {
      console.log(`  ${col.name}: ${col.type} (pk: ${col.pk}, notnull: ${col.notnull})`);
    }
    console.log('');

    // Get sample IDs with different approaches
    console.log('🔍 Sample ID Queries:\n');

    // Query 1: Select all columns
    const result1 = await db.execute(`SELECT * FROM memories LIMIT 3`);
    console.log('Query 1: SELECT * FROM memories LIMIT 3');
    console.log('Columns:', Object.keys(result1.rows[0] || {}));
    for (const row of result1.rows as any[]) {
      console.log(`  ID field value: ${row.id}, type: ${typeof row.id}`);
      console.log(`  All fields:`, Object.keys(row));
    }
    console.log('');

    // Query 2: Select just ID
    const result2 = await db.execute(`SELECT id FROM memories LIMIT 3`);
    console.log('Query 2: SELECT id FROM memories LIMIT 3');
    for (const row of result2.rows as any[]) {
      console.log(`  ID: ${row.id}, type: ${typeof row.id}`);
    }
    console.log('');

    // Query 3: Select with WHERE
    const result3 = await db.execute(`
      SELECT id, title FROM memories WHERE embedding = '[]' LIMIT 3
    `);
    console.log('Query 3: SELECT id, title FROM memories WHERE embedding = []');
    for (const row of result3.rows as any[]) {
      console.log(`  ID: ${row.id}, Title: ${row.title}`);
    }
    console.log('');

    // Query 4: ROWID
    const result4 = await db.execute(`
      SELECT ROWID, id, title FROM memories LIMIT 3
    `);
    console.log('Query 4: SELECT ROWID, id, title FROM memories');
    for (const row of result4.rows as any[]) {
      console.log(`  ROWID: ${row.ROWID}, ID: ${row.id}, Title: ${row.title}`);
    }

    await db.disconnect();
    console.log('\n✅ Check complete\n');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

checkIds();
