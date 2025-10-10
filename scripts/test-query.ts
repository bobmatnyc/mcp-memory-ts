#!/usr/bin/env tsx
/**
 * Test the exact query used in backfill
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
  console.log('\n🔍 Testing Query\n');

  try {
    const db = initDatabaseFromEnv();
    await db.connect();

    // Test the exact query from getMissingEmbeddingsIds
    const result = await db.execute(
      `
      SELECT id, title
      FROM memories
      WHERE embedding IS NULL
         OR embedding = '[]'
         OR json_array_length(embedding) = 0
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `,
      [5, 0]
    );

    console.log('Query result:');
    console.log('Row count:', result.rows.length);
    console.log('');

    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows[i] as any;
      console.log(`Row ${i}:`);
      console.log('  All keys:', Object.keys(row));
      console.log('  ID value:', row.id);
      console.log('  ID type:', typeof row.id);
      console.log('  Title:', row.title);
      console.log('  Raw row:', JSON.stringify(row, null, 2));
      console.log('');
    }

    // Test mapping
    const ids = (result.rows as any[]).map(row => row.id).filter(id => id !== null && id !== undefined);
    console.log('Mapped IDs:', ids);
    console.log('ID count:', ids.length);

    await db.disconnect();
    console.log('\n✅ Test complete\n');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testQuery();
