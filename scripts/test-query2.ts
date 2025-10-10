#!/usr/bin/env tsx
/**
 * Test different query approaches
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { initDatabaseFromEnv } from '../src/database/index.js';

const envLocalPath = resolve(process.cwd(), '.env.local');
const envPath = resolve(process.cwd(), '.env');

if (existsSync(envLocalPath)) {
  config({ path: envLocalPath });
} else if (existsSync(envPath)) {
  config({ path: envPath });
}

async function testQuery() {
  console.log('\n🔍 Testing Different Query Approaches\n');

  try {
    const db = initDatabaseFromEnv();
    await db.connect();

    // Approach 1: SELECT *
    console.log('='.repeat(60));
    console.log('Approach 1: SELECT * FROM memories');
    const result1 = await db.execute(
      `SELECT * FROM memories WHERE embedding = '[]' ORDER BY created_at DESC LIMIT 2`
    );
    console.log('Row count:', result1.rows.length);
    if (result1.rows.length > 0) {
      const row = result1.rows[0] as any;
      console.log('First row ID:', row.id);
      console.log('First row ID type:', typeof row.id);
    }
    console.log('');

    // Approach 2: SELECT with many columns
    console.log('='.repeat(60));
    console.log('Approach 2: SELECT id, title, content, memory_type');
    const result2 = await db.execute(
      `SELECT id, title, content, memory_type FROM memories WHERE embedding = '[]' ORDER BY created_at DESC LIMIT 2`
    );
    console.log('Row count:', result2.rows.length);
    if (result2.rows.length > 0) {
      const row = result2.rows[0] as any;
      console.log('First row ID:', row.id);
      console.log('First row ID type:', typeof row.id);
    }
    console.log('');

    // Approach 3: Use execute with no parameters
    console.log('='.repeat(60));
    console.log('Approach 3: No bind parameters');
    const result3 = await db.execute(
      `SELECT id, title FROM memories WHERE embedding = '[]' ORDER BY created_at DESC LIMIT 2`
    );
    console.log('Row count:', result3.rows.length);
    if (result3.rows.length > 0) {
      const row = result3.rows[0] as any;
      console.log('First row ID:', row.id);
      console.log('First row ID type:', typeof row.id);
    }
    console.log('');

    // Approach 4: Use different WHERE clause
    console.log('='.repeat(60));
    console.log('Approach 4: Different WHERE (LENGTH check)');
    const result4 = await db.execute(
      `SELECT id, title FROM memories WHERE LENGTH(embedding) <= 2 ORDER BY created_at DESC LIMIT 2`
    );
    console.log('Row count:', result4.rows.length);
    if (result4.rows.length > 0) {
      const row = result4.rows[0] as any;
      console.log('First row ID:', row.id);
      console.log('First row ID type:', typeof row.id);
    }
    console.log('');

    await db.disconnect();
    console.log('✅ Test complete\n');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testQuery();
