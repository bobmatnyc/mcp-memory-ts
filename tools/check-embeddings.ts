#!/usr/bin/env tsx
/**
 * Check embedding status in the database
 */

import { initDatabaseFromEnv } from '../src/database/index.js';

async function checkEmbeddings() {
  const db = initDatabaseFromEnv();
  await db.connect();

  console.log('Checking embedding status...\n');

  // Sample memories
  const result = await db.execute(
    'SELECT id, title, LENGTH(embedding) as emb_len FROM memories LIMIT 10'
  );
  console.log('Sample memories:');
  result.rows.forEach((row: any) => {
    console.log(`  ID: ${row.id}`);
    console.log(`  Title: ${row.title}`);
    console.log(`  Embedding Length: ${row.emb_len} bytes`);
    console.log('');
  });

  // Statistics
  const stats = await db.execute(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN embedding IS NULL THEN 1 ELSE 0 END) as null_embeddings,
      SUM(CASE WHEN embedding = '[]' THEN 1 ELSE 0 END) as empty_array,
      SUM(CASE WHEN LENGTH(embedding) < 10 THEN 1 ELSE 0 END) as too_short,
      SUM(CASE WHEN LENGTH(embedding) >= 10 THEN 1 ELSE 0 END) as has_data
    FROM memories
  `);

  console.log('Embedding Statistics:');
  console.log('  Total memories:', stats.rows[0].total);
  console.log('  NULL embeddings:', stats.rows[0].null_embeddings);
  console.log('  Empty arrays []:', stats.rows[0].empty_array);
  console.log('  Too short (<10 bytes):', stats.rows[0].too_short);
  console.log('  Has embedding data:', stats.rows[0].has_data);
  console.log('');

  // Check actual embedding content
  const embSample = await db.execute(`
    SELECT id, title, embedding
    FROM memories
    WHERE LENGTH(embedding) >= 10
    LIMIT 3
  `);
  console.log('Sample embeddings with data:');
  embSample.rows.forEach((row: any) => {
    const parsed = JSON.parse(row.embedding);
    console.log(`  ID: ${row.id}`);
    console.log(`  Title: ${row.title}`);
    console.log(`  Embedding dimensions: ${Array.isArray(parsed) ? parsed.length : 'invalid'}`);
    console.log('');
  });

  await db.disconnect();
}

checkEmbeddings().catch(console.error);
