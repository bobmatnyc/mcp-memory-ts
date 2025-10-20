import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config();

const client = createClient({
  url: process.env.TURSO_URL || '',
  authToken: process.env.TURSO_AUTH_TOKEN || '',
});

async function checkSchema() {
  console.log('=== SCHEMA CHECK ===\n');

  // Get memories table schema
  const schema = await client.execute(`
    SELECT sql FROM sqlite_master
    WHERE type='table' AND name='memories'
  `);
  console.log('MEMORIES TABLE SCHEMA:');
  console.log(schema.rows[0].sql);

  console.log('\n=== SAMPLE RECORDS ===\n');
  const sample = await client.execute(`
    SELECT id, user_id, memory_type, content, created_at
    FROM memories
    ORDER BY created_at DESC
    LIMIT 5
  `);

  sample.rows.forEach((row, i) => {
    const userId = row.user_id?.toString().substring(0, 12) || 'unknown';
    const content = row.content?.toString().substring(0, 80) || 'empty';
    console.log(`[${i+1}] Type: ${row.memory_type} | User: ${userId}...`);
    console.log(`    Content: ${content}...`);
    console.log(`    Created: ${row.created_at}\n`);
  });
}

checkSchema().catch(console.error);
