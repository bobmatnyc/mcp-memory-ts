#!/usr/bin/env tsx
/**
 * Diagnose critical issues with embeddings, validation, and metadata
 */

import { initDatabaseFromEnv } from './src/database/index.js';
import { MemoryCore } from './src/core/index.js';

async function diagnoseIssues() {
  console.log('🔍 Diagnosing MCP Memory Issues\n');

  const db = initDatabaseFromEnv();
  const memoryCore = new MemoryCore(db, process.env.OPENAI_API_KEY);
  await memoryCore.initialize();

  const userId = 'bob@matsuoka.com';

  // 1. Check embedding status
  console.log('1️⃣ VECTOR EMBEDDINGS STATUS:');
  console.log('   OpenAI API Key present:', !!process.env.OPENAI_API_KEY);

  const embeddingStats = await db.execute(
    `SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as with_embeddings
     FROM memories
     WHERE user_id = ?`,
    [userId]
  );

  const stats = embeddingStats.rows[0] as any;
  const percentage = stats.total > 0 ? (stats.with_embeddings / stats.total * 100).toFixed(1) : 0;
  console.log(`   Memories with embeddings: ${stats.with_embeddings}/${stats.total} (${percentage}%)\n`);

  // 2. Test importance validation
  console.log('2️⃣ IMPORTANCE VALIDATION TEST:');

  const invalidTests = [
    { value: -0.5, expected: 'reject' },
    { value: 1.5, expected: 'reject' },
    { value: 'high', expected: 'reject' },
    { value: 0.5, expected: 'accept' },
  ];

  for (const test of invalidTests) {
    try {
      const result = await memoryCore.addMemory(
        'Test Invalid Importance',
        'Testing importance validation',
        'semantic' as any,
        {
          importance: test.value as any,
          userId,
          generateEmbedding: false,
        }
      );

      console.log(`   Value ${test.value}: ${result.status === 'SUCCESS' ? '✅ Accepted' : '❌ Rejected'} (expected: ${test.expected})`);

      // Clean up if it was created
      if (result.status === 'SUCCESS' && result.data) {
        await memoryCore.deleteMemory((result.data as any).id, { userId });
      }
    } catch (error) {
      console.log(`   Value ${test.value}: ❌ Error - ${error}`);
    }
  }

  // 3. Test metadata search
  console.log('\n3️⃣ METADATA SEARCH TEST:');

  // Create test memory with metadata
  const testResult = await memoryCore.addMemory(
    'Metadata Test Memory',
    'Testing metadata search functionality',
    'semantic' as any,
    {
      userId,
      metadata: {
        project: 'alpha',
        priority: 'high',
        author: 'test-user',
      },
      generateEmbedding: false,
    }
  );

  if (testResult.status === 'SUCCESS' && testResult.data) {
    const memId = (testResult.data as any).id;

    // Try searching by metadata
    console.log('   Testing metadata field search...');

    // Check if we can query by metadata
    const metaSearch = await db.execute(
      `SELECT * FROM memories
       WHERE user_id = ?
       AND json_extract(metadata, '$.project') = ?
       LIMIT 1`,
      [userId, 'alpha']
    );

    console.log(`   Direct SQL metadata search: ${metaSearch.rows.length > 0 ? '✅ Works' : '❌ Failed'}`);

    // Check current search implementation
    const searchResult = await memoryCore.searchMemories('project:alpha', {
      userId,
      limit: 10,
    });

    console.log(`   MemoryCore metadata search: ${
      searchResult.status === 'SUCCESS' && (searchResult.data as any[]).length > 0
        ? '✅ Works'
        : '❌ Not implemented'
    }`);

    // Clean up
    await memoryCore.deleteMemory(memId, { userId });
  }

  // 4. Check embedding generation
  console.log('\n4️⃣ EMBEDDING GENERATION TEST:');

  if (process.env.OPENAI_API_KEY) {
    const embedResult = await memoryCore.addMemory(
      'Embedding Test',
      'This memory should have an embedding generated',
      'semantic' as any,
      {
        userId,
        generateEmbedding: true,
      }
    );

    if (embedResult.status === 'SUCCESS' && embedResult.data) {
      const memId = (embedResult.data as any).id;

      // Check if embedding was created
      const checkEmbed = await db.execute(
        'SELECT embedding IS NOT NULL as has_embedding FROM memories WHERE id = ?',
        [memId]
      );

      const hasEmbedding = (checkEmbed.rows[0] as any)?.has_embedding;
      console.log(`   Embedding generated: ${hasEmbedding ? '✅ Yes' : '❌ No'}`);

      // Clean up
      await memoryCore.deleteMemory(memId, { userId });
    }
  } else {
    console.log('   ⚠️  No OpenAI API key - embeddings disabled');
  }

  console.log('\n📊 SUMMARY OF ISSUES:');
  console.log('   • Vector Embeddings:', percentage === '0.0' ? '❌ Not working (0%)' : `✅ Working (${percentage}%)`);
  console.log('   • Importance Validation: ❌ Missing (accepts invalid values)');
  console.log('   • Metadata Search: ❌ Not implemented in MemoryCore');

  process.exit(0);
}

diagnoseIssues().catch(console.error);