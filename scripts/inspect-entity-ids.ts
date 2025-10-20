import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';
dotenv.config();

const db = createClient({
  url: process.env.TURSO_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function inspect() {
  // Get all memories and check entity_ids field
  const result = await db.execute('SELECT id, entity_ids FROM memories LIMIT 20');

  console.log('Sample of entity_ids field:\n');
  result.rows.forEach((row: any) => {
    console.log(`Memory ${row.id}:`);
    console.log(`  entity_ids: ${row.entity_ids}`);
    console.log(`  type: ${typeof row.entity_ids}`);
    console.log(`  is null: ${row.entity_ids === null}`);
    console.log(`  is empty string: ${row.entity_ids === ''}`);
    console.log(`  is []: ${row.entity_ids === '[]'}`);
    console.log('');
  });

  // Count different states
  const counts = await db.execute(`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN entity_ids IS NULL THEN 1 END) as null_count,
      COUNT(CASE WHEN entity_ids = '' THEN 1 END) as empty_string,
      COUNT(CASE WHEN entity_ids = '[]' THEN 1 END) as empty_array,
      COUNT(CASE WHEN entity_ids IS NOT NULL AND entity_ids != '' AND entity_ids != '[]' THEN 1 END) as has_data
    FROM memories
  `);

  console.log('Entity IDs Statistics:');
  console.log(counts.rows[0]);

  db.close();
}

inspect();
