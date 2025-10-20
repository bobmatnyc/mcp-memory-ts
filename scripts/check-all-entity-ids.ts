import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';
dotenv.config();

const db = createClient({
  url: process.env.TURSO_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const counts = await db.execute(`
  SELECT
    COUNT(*) as total,
    COUNT(CASE WHEN entity_ids IS NULL THEN 1 END) as null_count,
    COUNT(CASE WHEN entity_ids = '' THEN 1 END) as empty_string,
    COUNT(CASE WHEN entity_ids = '[]' THEN 1 END) as empty_array,
    COUNT(CASE WHEN entity_ids IS NOT NULL AND entity_ids != '' AND entity_ids != '[]' THEN 1 END) as has_data
  FROM memories
`);

console.log('Complete Entity IDs Statistics:');
console.log(counts.rows[0]);

// Also check for any memories with non-empty entity_ids
const withData = await db.execute(`
  SELECT id, entity_ids, content
  FROM memories
  WHERE entity_ids IS NOT NULL AND entity_ids != '' AND entity_ids != '[]'
  LIMIT 10
`);

if (withData.rows.length > 0) {
  console.log('\n Sample memories with entity_ids data:');
  withData.rows.forEach((row: any) => {
    console.log(`  ${row.id}: ${row.entity_ids}`);
  });
} else {
  console.log('\n✅ No memories have entity_ids with data - all cleaned!');
}

db.close();
