#!/usr/bin/env node
/**
 * Diagnose embedding generation issues
 */

import { initDatabaseFromEnv } from '../dist/database/index.js';

async function diagnose() {
  console.log('🔍 Diagnosing embedding generation...\n');

  const db = initDatabaseFromEnv();
  await db.connect();

  try {
    // Check total memories
    const totalResult = await db.execute('SELECT COUNT(*) as count FROM memories');
    const totalMemories = (totalResult.rows[0] as any).count;
    console.log(`📊 Total memories: ${totalMemories}`);

    // Check memories with embeddings
    const withEmbeddingsResult = await db.execute(`
      SELECT COUNT(*) as count FROM memories
      WHERE embedding IS NOT NULL
        AND embedding != '[]'
        AND json_array_length(embedding) > 0
    `);
    const withEmbeddings = (withEmbeddingsResult.rows[0] as any).count;
    console.log(`✅ Memories with embeddings: ${withEmbeddings}`);

    // Check memories without embeddings
    const withoutEmbeddingsResult = await db.execute(`
      SELECT COUNT(*) as count FROM memories
      WHERE embedding IS NULL
         OR embedding = '[]'
         OR json_array_length(embedding) = 0
    `);
    const withoutEmbeddings = (withoutEmbeddingsResult.rows[0] as any).count;
    console.log(`❌ Memories without embeddings: ${withoutEmbeddings}`);

    // Show recent memories (last 10)
    console.log('\n📝 Recent memories (last 10):\n');
    const recentResult = await db.execute(`
      SELECT
        id,
        title,
        CASE
          WHEN embedding IS NULL THEN 'NULL'
          WHEN embedding = '[]' THEN 'EMPTY_ARRAY'
          WHEN json_array_length(embedding) = 0 THEN 'ZERO_LENGTH'
          ELSE 'HAS_EMBEDDING (' || json_array_length(embedding) || 'd)'
        END as embedding_status,
        created_at
      FROM memories
      ORDER BY created_at DESC
      LIMIT 10
    `);

    recentResult.rows.forEach((row: any, index: number) => {
      const status = row.embedding_status.includes('HAS_EMBEDDING') ? '✅' : '❌';
      console.log(`${status} ${index + 1}. [${row.created_at}] ${row.title}`);
      console.log(`   ID: ${row.id}`);
      console.log(`   Embedding: ${row.embedding_status}\n`);
    });

    // Check OpenAI API key availability
    const hasApiKey = !!process.env.OPENAI_API_KEY;
    console.log(`\n🔑 OpenAI API Key: ${hasApiKey ? '✅ Present' : '❌ Missing'}`);

    if (!hasApiKey) {
      console.log('\n⚠️  WARNING: No OpenAI API key found!');
      console.log('   Embeddings cannot be generated without OPENAI_API_KEY in environment.');
    }

    // Calculate coverage
    const coverage = totalMemories > 0 ? Math.round((withEmbeddings / totalMemories) * 100) : 0;
    console.log(`\n📈 Embedding coverage: ${coverage}%`);

    if (coverage < 100) {
      console.log(`\n💡 Recommendation: Run 'npm run regenerate-embeddings' to fix missing embeddings.`);
    }

  } finally {
    await db.disconnect();
  }
}

diagnose().catch(error => {
  console.error('❌ Diagnostic failed:', error);
  process.exit(1);
});
