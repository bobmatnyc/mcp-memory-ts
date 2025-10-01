#!/usr/bin/env tsx
/**
 * Debug which memories have empty embeddings
 */

import { initDatabaseFromEnv } from '../src/database/index.js';

async function debugEmptyEmbeddings() {
  const db = initDatabaseFromEnv();
  await db.connect();

  const result = await db.execute(`
    SELECT id, title, content, embedding, created_at, updated_at
    FROM memories
    WHERE embedding = '[]' OR LENGTH(embedding) < 10
    ORDER BY created_at DESC
  `);

  console.log(`Found ${result.rows.length} memories with empty embeddings:\n`);

  result.rows.forEach((row: any, index: number) => {
    console.log(`${index + 1}. ID: ${row.id || 'NULL'}`);
    console.log(`   Title: ${row.title}`);
    console.log(`   Content: ${row.content.substring(0, 100)}...`);
    console.log(`   Embedding: ${row.embedding}`);
    console.log(`   Created: ${row.created_at}`);
    console.log(`   Updated: ${row.updated_at}`);
    console.log('');
  });

  await db.disconnect();
}

debugEmptyEmbeddings().catch(console.error);
